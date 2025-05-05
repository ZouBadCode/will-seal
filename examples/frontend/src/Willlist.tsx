import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { Button, Card, Flex } from '@radix-ui/themes';
import { useNetworkVariable } from './networkConfig';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { isValidSuiAddress } from '@mysten/sui/utils';
import { getObjectExplorerLink } from './utils';

export interface Willlist {
    id: string;
    name: string;
    list: string[];
}

interface WilllistProps {
    setRecipientAllowlist: React.Dispatch<React.SetStateAction<string>>;
    setCapId: React.Dispatch<React.SetStateAction<string>>;
}

export function Willlist({ setRecipientAllowlist, setCapId }: WilllistProps) {
    const packageId = useNetworkVariable('packageId');
    const suiClient = useSuiClient();
    const currentAccount = useCurrentAccount();
    const [willlist, setWilllist] = useState<Willlist>();
    const { id } = useParams();
    const [capId, setInnerCapId] = useState<string>();

    useEffect(() => {
        async function getWilllist() {
            // load all caps
            const res = await suiClient.getOwnedObjects({
                owner: currentAccount?.address!,
                options: {
                    showContent: true,
                    showType: true,
                },
                filter: {
                    StructType: `${packageId}::will::Cap`,
                },
            });

            // find the cap for the given willlist id
            const capId = res.data
                .map((obj) => {
                    const fields = (obj!.data!.content as { fields: any }).fields;
                    return {
                        id: fields?.id.id,
                        willlist_id: fields?.willlist_id,
                    };
                })
                .filter((item) => item.willlist_id === id)
                .map((item) => item.id) as string[];
            setCapId(capId[0]);
            setInnerCapId(capId[0]);

            // load the willlist for the given id
            const willlist = await suiClient.getObject({
                id: id!,
                options: { showContent: true },
            });
            const fields = (willlist.data?.content as { fields: any })?.fields || {};
            setWilllist({ id: id!, name: fields.name, list: fields.list });
            setRecipientAllowlist(id!);
        }

        getWilllist();

        const intervalId = setInterval(() => {
            getWilllist();
          }, 3000);

        return () => clearInterval(intervalId);
    }, [id, suiClient, packageId]);

    const { mutate: signAndExecute } = useSignAndExecuteTransaction({
        execute: async ({ bytes, signature }) =>
            await suiClient.executeTransactionBlock({
                transactionBlock: bytes,
                signature,
                options: {
                    showRawEffects: true,
                    showEffects: true,
                },
            }),
    });

    const grantAccess = (addressToGrant: string, service_id: string, cap_id: string) => {
        if (addressToGrant.trim() !== '') {
            if (!isValidSuiAddress(addressToGrant.trim())) {
            alert('Invalid address');
            return;
        }
        const tx = new Transaction();
        tx.moveCall({
            arguments: [
                tx.object(addressToGrant),
                tx.object(service_id),
                tx.object(cap_id),
            ],
            target: `${packageId}::will::grant_access`,
        })

        signAndExecute(
            {
                transaction: tx,
            },
            {
                onSuccess: async (result) => {
                    console.log('res', result);
                    },
                },
            );
        }
    };

    return (
        <div className="flex flex-col gap-2">
            {willlist?.list?.map((address) => (
                <Card key={address} className="flex justify-between items-center p-2">
                    <Flex align="center" gap="2" className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        <span>{address}</span>
                        <a
                            href={getObjectExplorerLink(id!).toString()}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:underline"
                        >
                            View on Explorer
                        </a>
                    </Flex>
                    <Button
                        variant="ghost"
                        size="2"
                        onClick={() => grantAccess(address, id!, capId!)}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </Card>
            ))}
        </div>
    )
}