import { useEffect, useState } from 'react';
import { useSignPersonalMessage, useSuiClient } from '@mysten/dapp-kit';
import { useNetworkVariable } from './networkConfig';
import { AlertDialog, Button, Card, Dialog, Flex, Grid } from '@radix-ui/themes';
import { fromHex } from '@mysten/sui/utils';
import { Transaction } from '@mysten/sui/transactions';
import { SuiClient } from '@mysten/sui/client';
import { getAllowlistedKeyServers, SealClient, SessionKey, NoAccessError } from '@mysten/seal';
import { useParams } from 'react-router-dom';
import { downloadAndDecrypt } from './utils';

const TTL_MIN = 10;
export interface FeedData {
  allowlistId: string;
  allowlistName: string;
  blobIds: string[];
}

function constructMoveCall(packageId: string, allowlistId: string) {
  return (tx: Transaction, id: string) => {
    tx.moveCall({
      target: `${packageId}::allowlist::seal_approve`,
      arguments: [tx.pure.vector('u8', fromHex(id)), tx.object(allowlistId)],
    });
  };
}

const Feeds: React.FC<{ suiAddress: string }> = ({ suiAddress }) => {
  const suiClient = useSuiClient();
  const client = new SealClient({
    suiClient,
    serverObjectIds: getAllowlistedKeyServers('testnet'),
    verifyKeyServers: false,
  });
  const packageId = useNetworkVariable('packageId');

  const [feed, setFeed] = useState<FeedData>();
  const [decryptedTexts, setDecryptedTexts] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentSessionKey, setCurrentSessionKey] = useState<SessionKey | null>(null);
  const { id } = useParams();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const { mutate: signPersonalMessage } = useSignPersonalMessage();

  useEffect(() => {
    getFeed();
    const intervalId = setInterval(getFeed, 3000);
    return () => clearInterval(intervalId);
  }, [id, suiClient, packageId]);

  async function getFeed() {
    const allowlist = await suiClient.getObject({ id: id!, options: { showContent: true } });
    const encryptedObjects = await suiClient.getDynamicFields({ parentId: id! }).then(res =>
      res.data.map(obj => obj.name.value as string)
    );
    const fields = (allowlist.data?.content as { fields: any })?.fields || {};
    setFeed({ allowlistId: id!, allowlistName: fields.name, blobIds: encryptedObjects });
  }

  const onView = async (blobIds: string[], allowlistId: string) => {
    // ensure valid sessionKey
    if (currentSessionKey && !currentSessionKey.isExpired() && currentSessionKey.getAddress() === suiAddress) {
      await handleDecrypt(blobIds, allowlistId, currentSessionKey);
      return;
    }
    setCurrentSessionKey(null);
    const sessionKey = new SessionKey({ address: suiAddress, packageId, ttlMin: TTL_MIN });
    signPersonalMessage(
      { message: sessionKey.getPersonalMessage() },
      {
        onSuccess: async result => {
          await sessionKey.setPersonalMessageSignature(result.signature);
          await handleDecrypt(blobIds, allowlistId, sessionKey);
          setCurrentSessionKey(sessionKey);
        },
      }
    );
  };

  const handleDecrypt = async (blobIds: string[], allowlistId: string, sessionKey: SessionKey) => {
    const moveCallConstructor = constructMoveCall(packageId, allowlistId);
    await downloadAndDecrypt(
      blobIds,
      sessionKey,
      suiClient,
      client,
      moveCallConstructor,
      setError,
      setDecryptedTexts,     // now collects text instead of URLs
      setIsDialogOpen,
      setDecryptedTexts,
      setReloadKey
    );
  };

  return (
    <Card>
      <h2 style={{ marginBottom: '1rem' }}>
        Files for Allowlist {feed?.allowlistName} (ID{' '}
        {feed?.allowlistId && <a href={`https://testnet.suivision.xyz/object/${feed.allowlistId}`} target="_blank" rel="noopener noreferrer">{feed.allowlistId.slice(0, 10)}...</a>}
        )
      </h2>
      {!feed ? (
        <p>No files found for this allowlist.</p>
      ) : (
        <Grid columns="2" gap="3">
          <Card key={feed.allowlistId}>
            <Flex direction="column" align="start" gap="2">
              {feed.blobIds.length === 0 ? (
                <p>No files found for this allowlist.</p>
              ) : (
                <Dialog.Root open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <Dialog.Trigger>
                    <Button onClick={() => onView(feed.blobIds, feed.allowlistId)}>
                      Download And Decrypt All Files
                    </Button>
                  </Dialog.Trigger>
                  {decryptedTexts.length > 0 && (
                    <Dialog.Content maxWidth="450px" key={reloadKey}>
                      <Dialog.Title>Decrypted Texts</Dialog.Title>
                      <Flex direction="column" gap="2">
                        {decryptedTexts.map((txt, idx) => (
                          <pre key={idx} className="bg-gray-100 p-2 rounded mb-2 whitespace-pre-wrap">
                            {txt}
                          </pre>
                        ))}
                      </Flex>
                      <Flex gap="3" mt="4" justify="end">
                        <Dialog.Close>
                          <Button variant="soft" color="gray" onClick={() => setDecryptedTexts([])}>
                            Close
                          </Button>
                        </Dialog.Close>
                      </Flex>
                    </Dialog.Content>
                  )}
                </Dialog.Root>
              )}
            </Flex>
          </Card>
        </Grid>
      )}
      <AlertDialog.Root open={!!error} onOpenChange={() => setError(null)}>
        <AlertDialog.Content maxWidth="450px">
          <AlertDialog.Title>Error</AlertDialog.Title>
          <AlertDialog.Description size="2">{error}</AlertDialog.Description>
          <Flex gap="3" mt="4" justify="end">
            <AlertDialog.Action>
              <Button variant="solid" color="gray" onClick={() => setError(null)}>
                Close
              </Button>
            </AlertDialog.Action>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </Card>
  );
};

export default Feeds;
