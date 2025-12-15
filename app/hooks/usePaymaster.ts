"use client";

import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, type Address } from "viem";

/**
 * Paymaster ile gasless transaction göndermek için hook
 * Base Account connector otomatik olarak Paymaster kullanır
 */
export function usePaymaster() {
  const { address } = useAccount();

  const { sendTransaction, data: hash, isPending, error } = useSendTransaction();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash,
    });

  const sendGaslessTransaction = async (to: Address, value: string) => {
    try {
      await sendTransaction({
        to,
        value: parseEther(value),
      });
    } catch (err) {
      console.error("Transaction error:", err);
      throw err;
    }
  };

  return {
    sendGaslessTransaction,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    error,
  };
}

