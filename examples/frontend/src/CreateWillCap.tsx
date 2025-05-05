import { Transaction } from '@mysten/sui/transactions';
import { Button, Card, Flex } from '@radix-ui/themes';
import { useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { useState } from 'react';
import { useNetworkVariable } from './networkConfig';
import { useNavigate } from 'react-router-dom';

export function CreateWillList() {
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const packageId = useNetworkVariable('packageId');
    const suiClient = useSuiClient();
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
    
    function createWillList(name: string) {
        if (name === '') {
        alert('Please enter a name for the will list');
        return;
        }
        const tx = new Transaction();
        tx.moveCall({
        target: `${packageId}::will::create_service_entry`,
        arguments: [tx.pure.string(name)],
        });
        tx.setGasBudget(10000000);
        signAndExecute(
        {
            transaction: tx,
        },
        {
            onSuccess: async (result) => {
            console.log('res', result);
            // Extract the created will list object ID from the transaction result
            const willListObject = result.effects?.created?.find(
                (item) => item.owner && typeof item.owner === 'object' && 'Shared' in item.owner,
            );
            const createdObjectId = willListObject?.reference?.objectId;
            if (createdObjectId) {
                window.open(
                `${window.location.origin}/will-example/admin/will/${createdObjectId}`,
                '_blank',
                );
            }
            },
        },
        );
    }

    const handleViewAll = () => {
        navigate('/will-example/admin/will');
    };

    return (
        <Card style={{ padding: '20px', width: '400px', margin: '0 auto' }}>
            <Flex direction="column" gap="20px">
                <input
                    type="text"
                    placeholder="Enter will list name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />
                <Button variant="solid" onClick={() => createWillList(name)}>
                    Create Will List
                </Button>
                <Button variant="soft" onClick={handleViewAll}>
                    View All Will Lists
                </Button>
            </Flex>
        </Card>
    );
}