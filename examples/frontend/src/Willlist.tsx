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

    // 添加日誌以追蹤組件初始化
    console.log('[Willlist] 組件初始化', { packageId, currentAccount, id });

    useEffect(() => {
        console.log('[Willlist] useEffect 開始執行', { id, currentAccount });
        
        async function getWilllist() {
            console.log('[getWilllist] 開始載入資料');
            
            // 檢查必要條件
            if (!currentAccount?.address) {
                console.error('[getWilllist] 缺少當前帳戶地址');
                return;
            }
            
            if (!id) {
                console.error('[getWilllist] 缺少 willlist ID');
                return;
            }
            
            try {
                // load all caps
                console.log('[getWilllist] 正在查詢擁有的物件，過濾條件:', `${packageId}::will::Cap`);
                const res = await suiClient.getOwnedObjects({
                    owner: currentAccount.address,
                    options: {
                        showContent: true,
                        showType: true,
                    },
                    filter: {
                        StructType: `${packageId}::will::Cap`,
                    },
                });
                console.log('[getWilllist] 查詢擁有的物件結果:', res);

                // find the cap for the given willlist id
                console.log('[getWilllist] 正在過濾 willlist id 匹配的 cap');
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
                
                console.log('[getWilllist] 過濾後的 capId 陣列:', capId);
                
                if (capId.length === 0) {
                    console.warn('[getWilllist] 未找到匹配的 cap');
                }
                
                setCapId(capId[0]);
                setInnerCapId(capId[0]);
                console.log('[getWilllist] 設置 capId:', capId[0]);

                // load the willlist for the given id
                console.log('[getWilllist] 正在載入 willlist 物件:', id);
                const willlist = await suiClient.getObject({
                    id: id,
                    options: { showContent: true },
                });
                console.log('[getWilllist] willlist 物件載入結果:', willlist);
                
                const fields = (willlist.data?.content as { fields: any })?.fields || {};
                console.log('[getWilllist] willlist 字段:', fields);
                
                setWilllist({ id: id, name: fields.name, list: fields.list });
                setRecipientAllowlist(id);
                console.log('[getWilllist] 設置 willlist 狀態完成');
            } catch (error) {
                console.error('[getWilllist] 發生錯誤:', error);
            }
        }

        getWilllist();

        console.log('[Willlist] 設置定時器，每 3 秒刷新一次');
        const intervalId = setInterval(() => {
            console.log('[Willlist] 定時器觸發，重新獲取 willlist');
            getWilllist();
        }, 3000);

        return () => {
            console.log('[Willlist] 清除定時器:', intervalId);
            clearInterval(intervalId);
        };
    }, [id, suiClient, packageId, currentAccount, setCapId, setRecipientAllowlist]);

    const { mutate: signAndExecute } = useSignAndExecuteTransaction({
        execute: async ({ bytes, signature }) => {
            console.log('[signAndExecute] 執行交易:', { bytes });
            const result = await suiClient.executeTransactionBlock({
                transactionBlock: bytes,
                signature,
                options: {
                    showRawEffects: true,
                    showEffects: true,
                },
            });
            console.log('[signAndExecute] 交易執行結果:', result);
            return result;
        },
    });

    const grantAccess = (addressToGrant: string, service_id: string, cap_id: string) => {
        console.log('[grantAccess] 被調用，參數:', { addressToGrant, service_id, cap_id });
        
        if (addressToGrant.trim() !== '') {
            if (!isValidSuiAddress(addressToGrant.trim())) {
                console.error('[grantAccess] 無效地址:', addressToGrant);
                alert('Invalid address');
                return;
            }
            
            console.log('[grantAccess] 創建交易');
            const tx = new Transaction();
            tx.moveCall({
                arguments: [
                    tx.object(addressToGrant),
                    tx.object(service_id),
                    tx.object(cap_id),
                ],
                target: `${packageId}::will::grant_access`,
            });
            
            console.log('[grantAccess] 交易詳情:', { 
                target: `${packageId}::will::grant_access`,
                arguments: [addressToGrant, service_id, cap_id]
            });

            signAndExecute(
                {
                    transaction: tx,
                },
                {
                    onSuccess: async (result) => {
                        console.log('[grantAccess] 交易成功:', result);
                    },
                    onError: (error) => {
                        console.error('[grantAccess] 交易失敗:', error);
                    }
                },
            );
        } else {
            console.warn('[grantAccess] 地址為空，不執行操作');
        }
    };

    console.log('[Willlist] 渲染組件，當前狀態:', { willlist, capId });

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
                onClick={() => { 
                  console.log('[Willlist] 點擊授權按鈕:', { address, id, capId }); 
                  grantAccess(address, id!, capId!); 
                }} 
              > 
                <X className="h-4 w-4" /> 
              </Button> 
            </Card> 
          ))} 
        </div> 
      )
}