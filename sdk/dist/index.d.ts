import { approve } from './approve.js';
import { approveSync } from './approveSync.js';
import { getAllowance } from './getAllowance.js';
import { getBalance } from './getBalance.js';
import { getMetadata } from './getMetadata.js';
import { getTotalSupply } from './getTotalSupply.js';
import { transfer } from './transfer.js';
import { transferSync } from './transferSync.js';
import { Hex } from '../../types/misc.js';
import { Prettify } from '../../types/utils.js';
import { ValidateSiweMessageParameters } from '../../utils/siwe/validateSiweMessage.js';
import { BlockParameters } from '../public/verifyHash.js';
import { Hex as Hex$1 } from '../types/misc.js';
import * as viem from 'viem';
import { PublicClient, WalletClient } from 'viem';

type Side = 'LONG' | 'SHORT';
type MarketStatus = 'OPEN' | 'SETTLED';
type WeatherVariable = 'RAINFALL' | 'TEMPERATURE';
type PayoffType = 'BINARY' | 'LINEAR' | 'CAPPED';
interface Market {
    contractAddress: string;
    chainId: number;
    regionId: string;
    regionName: string | null;
    weatherVariable: WeatherVariable;
    payoffType: PayoffType;
    thresholdLow: number;
    thresholdHigh: number | null;
    expiryTimestamp: string;
    collateralToken: string;
    status: MarketStatus;
    finalOracleValue: number | null;
    longPayoutRatio: number | null;
    shortPayoutRatio: number | null;
    settledAt: string | null;
    createdAt: string;
    blockNumber: number;
    txHash: string;
}
interface Position {
    id: string;
    marketAddress: string;
    tokenId: string;
    holderAddress: string;
    side: Side;
    collateralAsset: string;
    collateralAmount: string;
    mintedAt: string;
    blockNumber: number;
    txHash: string;
    redeemed: boolean;
    redeemedAmount: string | null;
    redeemedAt: string | null;
    redeemTxHash: string | null;
    market?: Pick<Market, 'regionName' | 'weatherVariable' | 'expiryTimestamp' | 'status'>;
}
interface WeatherReading {
    regionId: string;
    regionName: string | null;
    variable: WeatherVariable;
    value: number;
    readingTimestamp: string;
}
interface CreateMarketParams {
    regionId: `0x${string}`;
    weatherVariable: WeatherVariable;
    payoffType: PayoffType;
    thresholdLow: bigint;
    thresholdHigh: bigint;
    expiryTimestamp: bigint;
    collateralToken: `0x${string}`;
    oracleAddress?: `0x${string}`;
}
interface MintPositionParams {
    marketAddress: `0x${string}`;
    side: Side;
    collateralAmount: bigint;
}
interface BreezeSwapConfig {
    indexerUrl: string;
    rpcUrl: string;
    chainId: number;
}

declare const COSTON2_CHAIN_ID = 114;
declare const CONTRACT_ADDRESSES: {
    readonly 114: {
        readonly accessControl: `0x${string}`;
        readonly factory: `0x${string}`;
        readonly marketFactory: `0x${string}`;
        readonly positionToken: `0x${string}`;
        readonly mockWeatherOracle: `0x${string}`;
        readonly oracle: `0x${string}`;
        readonly mockUsdt: `0x${string}`;
        readonly fTestXrp: `0x${string}`;
        readonly ftsoWeatherAdapter: `0x${string}`;
        readonly fdcWeatherAdapter: `0x${string}`;
        readonly fAssetsCollateralAdapter: `0x${string}`;
    };
};
declare const ORACLE_DECIMALS = 6n;
declare const ORACLE_SCALAR: bigint;
declare const WAD: bigint;
declare const WEATHER_VARIABLES: {
    readonly RAINFALL: 0;
    readonly TEMPERATURE: 1;
};
declare const PAYOFF_TYPES: {
    readonly BINARY: 0;
    readonly LINEAR: 1;
    readonly CAPPED: 2;
};
declare const SIDES: {
    readonly LONG: 0;
    readonly SHORT: 1;
};

type VerifySiweMessageParameters = Prettify<Pick<ValidateSiweMessageParameters, 'address' | 'domain' | 'nonce' | 'scheme' | 'time'> & {
    /**
     * EIP-4361 formatted message.
     */
    message: string;
    /**
     * Signature to check against.
     */
    signature: Hex;
}> & BlockParameters;
type VerifySiweMessageReturnType = boolean;

type CcipRequestReturnType = Hex$1;

declare const coston2Chain: {
    blockExplorers: {
        readonly default: {
            readonly name: "Coston2 Explorer";
            readonly url: "https://coston2-explorer.flare.network";
        };
    };
    blockTime?: number | undefined | undefined;
    contracts?: {
        [x: string]: viem.ChainContract | {
            [sourceId: number]: viem.ChainContract | undefined;
        } | undefined;
        ensRegistry?: viem.ChainContract | undefined;
        ensUniversalResolver?: viem.ChainContract | undefined;
        multicall3?: viem.ChainContract | undefined;
        erc6492Verifier?: viem.ChainContract | undefined;
    } | undefined;
    ensTlds?: readonly string[] | undefined;
    id: 114;
    name: "Flare Coston2";
    nativeCurrency: {
        readonly name: "Coston2 FLR";
        readonly symbol: "C2FLR";
        readonly decimals: 18;
    };
    experimental_preconfirmationTime?: number | undefined | undefined;
    rpcUrls: {
        readonly default: {
            readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
        };
        readonly public: {
            readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
        };
    };
    sourceId?: number | undefined | undefined;
    supportsTransactionReplacementDetection?: boolean | undefined | undefined;
    testnet?: boolean | undefined | undefined;
    custom?: Record<string, unknown> | undefined;
    extendSchema?: Record<string, unknown> | undefined;
    fees?: viem.ChainFees<undefined> | undefined;
    formatters?: undefined;
    prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
        client: viem.Client;
        phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
    }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
        client: viem.Client;
        phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
    }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
        runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
    }] | undefined;
    serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
    verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
};
declare function createBreezePublicClient(rpcUrl?: string): {
    account: undefined;
    batch?: {
        multicall?: boolean | viem.Prettify<viem.MulticallBatchOptions> | undefined;
    } | undefined;
    cacheTime: number;
    ccipRead?: false | {
        request?: (parameters: viem.CcipRequestParameters) => Promise<CcipRequestReturnType>;
    } | undefined;
    chain: {
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    };
    dataSuffix?: viem.DataSuffix | undefined;
    experimental_blockTag?: viem.BlockTag | undefined;
    key: string;
    name: string;
    pollingInterval: number;
    request: viem.EIP1193RequestFn<viem.PublicRpcSchema>;
    tokens: undefined;
    transport: viem.TransportConfig<"http", viem.EIP1193RequestFn> & {
        fetchOptions?: viem.HttpTransportConfig["fetchOptions"] | undefined;
        url?: string | undefined;
    };
    type: string;
    uid: string;
    call: (parameters: viem.CallParameters<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }>) => Promise<viem.CallReturnType>;
    createAccessList: (parameters: viem.CreateAccessListParameters<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }>) => Promise<{
        accessList: viem.AccessList;
        gasUsed: bigint;
    }>;
    createBlockFilter: () => Promise<viem.CreateBlockFilterReturnType>;
    createContractEventFilter: <const abi extends viem.Abi | readonly unknown[], eventName extends viem.ContractEventName<abi> | undefined, args extends viem.MaybeExtractEventArgsFromAbi<abi, eventName> | undefined, strict extends boolean | undefined = undefined, fromBlock extends viem.BlockNumber | viem.BlockTag | undefined = undefined, toBlock extends viem.BlockNumber | viem.BlockTag | undefined = undefined>(args: viem.CreateContractEventFilterParameters<abi, eventName, args, strict, fromBlock, toBlock>) => Promise<viem.CreateContractEventFilterReturnType<abi, eventName, args, strict, fromBlock, toBlock>>;
    createEventFilter: <const abiEvent extends viem.AbiEvent | undefined = undefined, const abiEvents extends readonly viem.AbiEvent[] | readonly unknown[] | undefined = abiEvent extends viem.AbiEvent ? [abiEvent] : undefined, strict extends boolean | undefined = undefined, fromBlock extends viem.BlockNumber | viem.BlockTag | undefined = undefined, toBlock extends viem.BlockNumber | viem.BlockTag | undefined = undefined, _EventName extends string | undefined = viem.MaybeAbiEventName<abiEvent>, _Args extends viem.MaybeExtractEventArgsFromAbi<abiEvents, _EventName> | undefined = undefined>(args?: viem.CreateEventFilterParameters<abiEvent, abiEvents, strict, fromBlock, toBlock, _EventName, _Args> | undefined) => Promise<viem.CreateEventFilterReturnType<abiEvent, abiEvents, strict, fromBlock, toBlock, _EventName, _Args>>;
    createPendingTransactionFilter: () => Promise<viem.CreatePendingTransactionFilterReturnType>;
    estimateContractGas: <chain extends viem.Chain | undefined, const abi extends viem.Abi | readonly unknown[], functionName extends viem.ContractFunctionName<abi, "nonpayable" | "payable">, args extends viem.ContractFunctionArgs<abi, "nonpayable" | "payable", functionName>>(args: viem.EstimateContractGasParameters<abi, functionName, args, chain>) => Promise<viem.EstimateContractGasReturnType>;
    estimateGas: (args: viem.EstimateGasParameters<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }>) => Promise<viem.EstimateGasReturnType>;
    fillTransaction: <chainOverride extends viem.Chain | undefined = undefined, accountOverride extends viem.Account | viem.Address | undefined = undefined>(args: viem.FillTransactionParameters<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, undefined, chainOverride, accountOverride>) => Promise<viem.FillTransactionReturnType<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>>;
    getBalance: (args: viem.GetBalanceParameters) => Promise<viem.GetBalanceReturnType>;
    getBlobBaseFee: () => Promise<viem.GetBlobBaseFeeReturnType>;
    getBlock: <includeTransactions extends boolean = false, blockTag extends viem.BlockTag = "latest">(args?: viem.GetBlockParameters<includeTransactions, blockTag> | undefined) => Promise<{
        number: blockTag extends "pending" ? null : bigint;
        hash: blockTag extends "pending" ? null : `0x${string}`;
        nonce: blockTag extends "pending" ? null : `0x${string}`;
        logsBloom: blockTag extends "pending" ? null : `0x${string}`;
        baseFeePerGas: bigint | null;
        blobGasUsed: bigint;
        difficulty: bigint;
        excessBlobGas: bigint;
        extraData: viem.Hex;
        gasLimit: bigint;
        gasUsed: bigint;
        miner: viem.Address;
        mixHash: viem.Hash;
        parentBeaconBlockRoot?: `0x${string}` | undefined;
        parentHash: viem.Hash;
        receiptsRoot: viem.Hex;
        sealFields: viem.Hex[];
        sha3Uncles: viem.Hash;
        size: bigint;
        stateRoot: viem.Hash;
        timestamp: bigint;
        totalDifficulty: bigint | null;
        transactionsRoot: viem.Hash;
        uncles: viem.Hash[];
        withdrawals?: viem.Withdrawal[] | undefined | undefined;
        withdrawalsRoot?: `0x${string}` | undefined;
        transactions: includeTransactions extends true ? ({
            chainId?: number | undefined;
            yParity?: undefined | undefined;
            blockTimestamp?: bigint | undefined;
            from: viem.Address;
            gas: bigint;
            hash: viem.Hash;
            input: viem.Hex;
            nonce: number;
            r: viem.Hex;
            s: viem.Hex;
            to: viem.Address | null;
            typeHex: viem.Hex | null;
            v: bigint;
            value: bigint;
            accessList?: undefined | undefined;
            authorizationList?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            type: "legacy";
            gasPrice: bigint;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: undefined | undefined;
            maxPriorityFeePerGas?: undefined | undefined;
            blockNumber: (blockTag extends "pending" ? true : false) extends infer T ? T extends (blockTag extends "pending" ? true : false) ? T extends true ? null : bigint : never : never;
            blockHash: (blockTag extends "pending" ? true : false) extends infer T_1 ? T_1 extends (blockTag extends "pending" ? true : false) ? T_1 extends true ? null : `0x${string}` : never : never;
            transactionIndex: (blockTag extends "pending" ? true : false) extends infer T_2 ? T_2 extends (blockTag extends "pending" ? true : false) ? T_2 extends true ? null : number : never : never;
        } | {
            chainId: number;
            yParity: number;
            blockTimestamp?: bigint | undefined;
            from: viem.Address;
            gas: bigint;
            hash: viem.Hash;
            input: viem.Hex;
            nonce: number;
            r: viem.Hex;
            s: viem.Hex;
            to: viem.Address | null;
            typeHex: viem.Hex | null;
            v: bigint;
            value: bigint;
            accessList: viem.AccessList;
            authorizationList?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            type: "eip2930";
            gasPrice: bigint;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: undefined | undefined;
            maxPriorityFeePerGas?: undefined | undefined;
            blockNumber: (blockTag extends "pending" ? true : false) extends infer T_3 ? T_3 extends (blockTag extends "pending" ? true : false) ? T_3 extends true ? null : bigint : never : never;
            blockHash: (blockTag extends "pending" ? true : false) extends infer T_4 ? T_4 extends (blockTag extends "pending" ? true : false) ? T_4 extends true ? null : `0x${string}` : never : never;
            transactionIndex: (blockTag extends "pending" ? true : false) extends infer T_5 ? T_5 extends (blockTag extends "pending" ? true : false) ? T_5 extends true ? null : number : never : never;
        } | {
            chainId: number;
            yParity: number;
            blockTimestamp?: bigint | undefined;
            from: viem.Address;
            gas: bigint;
            hash: viem.Hash;
            input: viem.Hex;
            nonce: number;
            r: viem.Hex;
            s: viem.Hex;
            to: viem.Address | null;
            typeHex: viem.Hex | null;
            v: bigint;
            value: bigint;
            accessList: viem.AccessList;
            authorizationList?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            type: "eip1559";
            gasPrice?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas: bigint;
            maxPriorityFeePerGas: bigint;
            blockNumber: (blockTag extends "pending" ? true : false) extends infer T_6 ? T_6 extends (blockTag extends "pending" ? true : false) ? T_6 extends true ? null : bigint : never : never;
            blockHash: (blockTag extends "pending" ? true : false) extends infer T_7 ? T_7 extends (blockTag extends "pending" ? true : false) ? T_7 extends true ? null : `0x${string}` : never : never;
            transactionIndex: (blockTag extends "pending" ? true : false) extends infer T_8 ? T_8 extends (blockTag extends "pending" ? true : false) ? T_8 extends true ? null : number : never : never;
        } | {
            chainId: number;
            yParity: number;
            blockTimestamp?: bigint | undefined;
            from: viem.Address;
            gas: bigint;
            hash: viem.Hash;
            input: viem.Hex;
            nonce: number;
            r: viem.Hex;
            s: viem.Hex;
            to: viem.Address | null;
            typeHex: viem.Hex | null;
            v: bigint;
            value: bigint;
            accessList: viem.AccessList;
            authorizationList?: undefined | undefined;
            blobVersionedHashes: readonly viem.Hex[];
            type: "eip4844";
            gasPrice?: undefined | undefined;
            maxFeePerBlobGas: bigint;
            maxFeePerGas: bigint;
            maxPriorityFeePerGas: bigint;
            blockNumber: (blockTag extends "pending" ? true : false) extends infer T_9 ? T_9 extends (blockTag extends "pending" ? true : false) ? T_9 extends true ? null : bigint : never : never;
            blockHash: (blockTag extends "pending" ? true : false) extends infer T_10 ? T_10 extends (blockTag extends "pending" ? true : false) ? T_10 extends true ? null : `0x${string}` : never : never;
            transactionIndex: (blockTag extends "pending" ? true : false) extends infer T_11 ? T_11 extends (blockTag extends "pending" ? true : false) ? T_11 extends true ? null : number : never : never;
        } | {
            chainId: number;
            yParity: number;
            blockTimestamp?: bigint | undefined;
            from: viem.Address;
            gas: bigint;
            hash: viem.Hash;
            input: viem.Hex;
            nonce: number;
            r: viem.Hex;
            s: viem.Hex;
            to: viem.Address | null;
            typeHex: viem.Hex | null;
            v: bigint;
            value: bigint;
            accessList: viem.AccessList;
            authorizationList: viem.SignedAuthorizationList;
            blobVersionedHashes?: undefined | undefined;
            type: "eip7702";
            gasPrice?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas: bigint;
            maxPriorityFeePerGas: bigint;
            blockNumber: (blockTag extends "pending" ? true : false) extends infer T_12 ? T_12 extends (blockTag extends "pending" ? true : false) ? T_12 extends true ? null : bigint : never : never;
            blockHash: (blockTag extends "pending" ? true : false) extends infer T_13 ? T_13 extends (blockTag extends "pending" ? true : false) ? T_13 extends true ? null : `0x${string}` : never : never;
            transactionIndex: (blockTag extends "pending" ? true : false) extends infer T_14 ? T_14 extends (blockTag extends "pending" ? true : false) ? T_14 extends true ? null : number : never : never;
        })[] : `0x${string}`[];
    }>;
    getBlockReceipts: (args?: viem.GetBlockReceiptsParameters | undefined) => Promise<viem.GetBlockReceiptsReturnType<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }>>;
    getBlockNumber: (args?: viem.GetBlockNumberParameters | undefined) => Promise<viem.GetBlockNumberReturnType>;
    getBlockTransactionCount: (args?: viem.GetBlockTransactionCountParameters | undefined) => Promise<viem.GetBlockTransactionCountReturnType>;
    getBytecode: (args: viem.GetBytecodeParameters) => Promise<viem.GetBytecodeReturnType>;
    getChainId: () => Promise<viem.GetChainIdReturnType>;
    getCode: (args: viem.GetBytecodeParameters) => Promise<viem.GetBytecodeReturnType>;
    getContractEvents: <const abi extends viem.Abi | readonly unknown[], eventName extends viem.ContractEventName<abi> | undefined = undefined, strict extends boolean | undefined = undefined, fromBlock extends viem.BlockNumber | viem.BlockTag | undefined = undefined, toBlock extends viem.BlockNumber | viem.BlockTag | undefined = undefined>(args: viem.GetContractEventsParameters<abi, eventName, strict, fromBlock, toBlock>) => Promise<viem.GetContractEventsReturnType<abi, eventName, strict, fromBlock, toBlock>>;
    getDelegation: (args: viem.GetDelegationParameters) => Promise<viem.GetDelegationReturnType>;
    getEip712Domain: (args: viem.GetEip712DomainParameters) => Promise<viem.GetEip712DomainReturnType>;
    getEnsAddress: (args: viem.GetEnsAddressParameters) => Promise<viem.GetEnsAddressReturnType>;
    getEnsAvatar: (args: viem.GetEnsAvatarParameters) => Promise<viem.GetEnsAvatarReturnType>;
    getEnsName: (args: viem.GetEnsNameParameters) => Promise<viem.GetEnsNameReturnType>;
    getEnsResolver: (args: viem.GetEnsResolverParameters) => Promise<viem.GetEnsResolverReturnType>;
    getEnsText: (args: viem.GetEnsTextParameters) => Promise<viem.GetEnsTextReturnType>;
    getFeeHistory: (args: viem.GetFeeHistoryParameters) => Promise<viem.GetFeeHistoryReturnType>;
    estimateFeesPerGas: <chainOverride extends viem.Chain | undefined = undefined, type extends viem.FeeValuesType = "eip1559">(args?: viem.EstimateFeesPerGasParameters<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride, type> | undefined) => Promise<viem.EstimateFeesPerGasReturnType<type>>;
    getFilterChanges: <filterType extends viem.FilterType, const abi extends viem.Abi | readonly unknown[] | undefined, eventName extends string | undefined, strict extends boolean | undefined = undefined, fromBlock extends viem.BlockNumber | viem.BlockTag | undefined = undefined, toBlock extends viem.BlockNumber | viem.BlockTag | undefined = undefined>(args: viem.GetFilterChangesParameters<filterType, abi, eventName, strict, fromBlock, toBlock>) => Promise<viem.GetFilterChangesReturnType<filterType, abi, eventName, strict, fromBlock, toBlock>>;
    getFilterLogs: <const abi extends viem.Abi | readonly unknown[] | undefined, eventName extends string | undefined, strict extends boolean | undefined = undefined, fromBlock extends viem.BlockNumber | viem.BlockTag | undefined = undefined, toBlock extends viem.BlockNumber | viem.BlockTag | undefined = undefined>(args: viem.GetFilterLogsParameters<abi, eventName, strict, fromBlock, toBlock>) => Promise<viem.GetFilterLogsReturnType<abi, eventName, strict, fromBlock, toBlock>>;
    getGasPrice: () => Promise<viem.GetGasPriceReturnType>;
    getLogs: <const abiEvent extends viem.AbiEvent | undefined = undefined, const abiEvents extends readonly viem.AbiEvent[] | readonly unknown[] | undefined = abiEvent extends viem.AbiEvent ? [abiEvent] : undefined, strict extends boolean | undefined = undefined, fromBlock extends viem.BlockNumber | viem.BlockTag | undefined = undefined, toBlock extends viem.BlockNumber | viem.BlockTag | undefined = undefined>(args?: viem.GetLogsParameters<abiEvent, abiEvents, strict, fromBlock, toBlock> | undefined) => Promise<viem.GetLogsReturnType<abiEvent, abiEvents, strict, fromBlock, toBlock>>;
    getProof: (args: viem.GetProofParameters) => Promise<viem.GetProofReturnType>;
    estimateMaxPriorityFeePerGas: <chainOverride extends viem.Chain | undefined = undefined>(args?: {
        chain?: chainOverride | null | undefined;
    } | undefined) => Promise<viem.EstimateMaxPriorityFeePerGasReturnType>;
    getRawTransaction: (args: viem.GetRawTransactionParameters) => Promise<viem.GetRawTransactionReturnType>;
    getStorageAt: (args: viem.GetStorageAtParameters) => Promise<viem.GetStorageAtReturnType>;
    getTransaction: <blockTag extends viem.BlockTag = "latest">(args: viem.GetTransactionParameters<blockTag>) => Promise<{
        chainId?: number | undefined;
        yParity?: undefined | undefined;
        blockTimestamp?: bigint | undefined;
        from: viem.Address;
        gas: bigint;
        hash: viem.Hash;
        input: viem.Hex;
        nonce: number;
        r: viem.Hex;
        s: viem.Hex;
        to: viem.Address | null;
        typeHex: viem.Hex | null;
        v: bigint;
        value: bigint;
        accessList?: undefined | undefined;
        authorizationList?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        type: "legacy";
        gasPrice: bigint;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: undefined | undefined;
        maxPriorityFeePerGas?: undefined | undefined;
        blockNumber: (blockTag extends "pending" ? true : false) extends infer T ? T extends (blockTag extends "pending" ? true : false) ? T extends true ? null : bigint : never : never;
        blockHash: (blockTag extends "pending" ? true : false) extends infer T_1 ? T_1 extends (blockTag extends "pending" ? true : false) ? T_1 extends true ? null : `0x${string}` : never : never;
        transactionIndex: (blockTag extends "pending" ? true : false) extends infer T_2 ? T_2 extends (blockTag extends "pending" ? true : false) ? T_2 extends true ? null : number : never : never;
    } | {
        chainId: number;
        yParity: number;
        blockTimestamp?: bigint | undefined;
        from: viem.Address;
        gas: bigint;
        hash: viem.Hash;
        input: viem.Hex;
        nonce: number;
        r: viem.Hex;
        s: viem.Hex;
        to: viem.Address | null;
        typeHex: viem.Hex | null;
        v: bigint;
        value: bigint;
        accessList: viem.AccessList;
        authorizationList?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        type: "eip2930";
        gasPrice: bigint;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: undefined | undefined;
        maxPriorityFeePerGas?: undefined | undefined;
        blockNumber: (blockTag extends "pending" ? true : false) extends infer T_3 ? T_3 extends (blockTag extends "pending" ? true : false) ? T_3 extends true ? null : bigint : never : never;
        blockHash: (blockTag extends "pending" ? true : false) extends infer T_4 ? T_4 extends (blockTag extends "pending" ? true : false) ? T_4 extends true ? null : `0x${string}` : never : never;
        transactionIndex: (blockTag extends "pending" ? true : false) extends infer T_5 ? T_5 extends (blockTag extends "pending" ? true : false) ? T_5 extends true ? null : number : never : never;
    } | {
        chainId: number;
        yParity: number;
        blockTimestamp?: bigint | undefined;
        from: viem.Address;
        gas: bigint;
        hash: viem.Hash;
        input: viem.Hex;
        nonce: number;
        r: viem.Hex;
        s: viem.Hex;
        to: viem.Address | null;
        typeHex: viem.Hex | null;
        v: bigint;
        value: bigint;
        accessList: viem.AccessList;
        authorizationList?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        type: "eip1559";
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas: bigint;
        maxPriorityFeePerGas: bigint;
        blockNumber: (blockTag extends "pending" ? true : false) extends infer T_6 ? T_6 extends (blockTag extends "pending" ? true : false) ? T_6 extends true ? null : bigint : never : never;
        blockHash: (blockTag extends "pending" ? true : false) extends infer T_7 ? T_7 extends (blockTag extends "pending" ? true : false) ? T_7 extends true ? null : `0x${string}` : never : never;
        transactionIndex: (blockTag extends "pending" ? true : false) extends infer T_8 ? T_8 extends (blockTag extends "pending" ? true : false) ? T_8 extends true ? null : number : never : never;
    } | {
        chainId: number;
        yParity: number;
        blockTimestamp?: bigint | undefined;
        from: viem.Address;
        gas: bigint;
        hash: viem.Hash;
        input: viem.Hex;
        nonce: number;
        r: viem.Hex;
        s: viem.Hex;
        to: viem.Address | null;
        typeHex: viem.Hex | null;
        v: bigint;
        value: bigint;
        accessList: viem.AccessList;
        authorizationList?: undefined | undefined;
        blobVersionedHashes: readonly viem.Hex[];
        type: "eip4844";
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas: bigint;
        maxFeePerGas: bigint;
        maxPriorityFeePerGas: bigint;
        blockNumber: (blockTag extends "pending" ? true : false) extends infer T_9 ? T_9 extends (blockTag extends "pending" ? true : false) ? T_9 extends true ? null : bigint : never : never;
        blockHash: (blockTag extends "pending" ? true : false) extends infer T_10 ? T_10 extends (blockTag extends "pending" ? true : false) ? T_10 extends true ? null : `0x${string}` : never : never;
        transactionIndex: (blockTag extends "pending" ? true : false) extends infer T_11 ? T_11 extends (blockTag extends "pending" ? true : false) ? T_11 extends true ? null : number : never : never;
    } | {
        chainId: number;
        yParity: number;
        blockTimestamp?: bigint | undefined;
        from: viem.Address;
        gas: bigint;
        hash: viem.Hash;
        input: viem.Hex;
        nonce: number;
        r: viem.Hex;
        s: viem.Hex;
        to: viem.Address | null;
        typeHex: viem.Hex | null;
        v: bigint;
        value: bigint;
        accessList: viem.AccessList;
        authorizationList: viem.SignedAuthorizationList;
        blobVersionedHashes?: undefined | undefined;
        type: "eip7702";
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas: bigint;
        maxPriorityFeePerGas: bigint;
        blockNumber: (blockTag extends "pending" ? true : false) extends infer T_12 ? T_12 extends (blockTag extends "pending" ? true : false) ? T_12 extends true ? null : bigint : never : never;
        blockHash: (blockTag extends "pending" ? true : false) extends infer T_13 ? T_13 extends (blockTag extends "pending" ? true : false) ? T_13 extends true ? null : `0x${string}` : never : never;
        transactionIndex: (blockTag extends "pending" ? true : false) extends infer T_14 ? T_14 extends (blockTag extends "pending" ? true : false) ? T_14 extends true ? null : number : never : never;
    }>;
    getTransactionConfirmations: (args: viem.GetTransactionConfirmationsParameters<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }>) => Promise<viem.GetTransactionConfirmationsReturnType>;
    getTransactionCount: (args: viem.GetTransactionCountParameters) => Promise<viem.GetTransactionCountReturnType>;
    getTransactionReceipt: (args: viem.GetTransactionReceiptParameters) => Promise<viem.TransactionReceipt>;
    multicall: <const contracts extends readonly unknown[], allowFailure extends boolean = true>(args: viem.MulticallParameters<contracts, allowFailure>) => Promise<viem.MulticallReturnType<contracts, allowFailure>>;
    prepareTransactionRequest: <const request extends viem.PrepareTransactionRequestRequest<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, chainOverride extends viem.Chain | undefined = undefined, accountOverride extends viem.Account | viem.Address | undefined = undefined>(args: viem.PrepareTransactionRequestParameters<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, undefined, chainOverride, accountOverride, request>) => Promise<viem.UnionRequiredBy<Extract<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> & (viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride> extends infer T_1 ? T_1 extends viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride> ? T_1 extends viem.Chain ? {
        chain: T_1;
    } : {
        chain?: undefined;
    } : never : never) & (viem.DeriveAccount<undefined, accountOverride> extends infer T_2 ? T_2 extends viem.DeriveAccount<undefined, accountOverride> ? T_2 extends viem.Account ? {
        account: T_2;
        from: viem.Address;
    } : {
        account?: undefined;
        from?: undefined;
    } : never : never), viem.IsNever<viem.ExtractFormattedTransactionRequest<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, {
        type?: ((request["type"] extends string ? request["type"] : viem.IsNever<viem.IsNever<Extract<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_3 ? T_3 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_3 extends object ? request extends viem.ExactPartial<T_3> ? T_3 extends {
            type?: infer type | undefined;
        } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>>> extends true ? Exclude<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_4 ? T_4 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_4 extends object ? request extends viem.ExactPartial<T_4> ? T_4 extends {
            type?: infer type | undefined;
        } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>> : never> extends false ? viem.IsNever<Extract<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_5 ? T_5 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_5 extends object ? request extends viem.ExactPartial<T_5> ? T_5 extends {
            type?: infer type | undefined;
        } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>>> extends true ? Exclude<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_6 ? T_6 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_6 extends object ? request extends viem.ExactPartial<T_6> ? T_6 extends {
            type?: infer type | undefined;
        } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>> : never : request["type"] extends string | undefined ? request["type"] : viem.GetTransactionType<request, (request extends {
            accessList?: undefined | undefined;
            authorizationList?: undefined | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: bigint | undefined;
            sidecars?: undefined | undefined;
        } & viem.FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: undefined | undefined;
        } & (viem.OneOf<{
            maxFeePerGas: viem.FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: viem.FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, viem.FeeValuesEIP1559> & {
            accessList?: viem.TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: bigint | undefined;
            sidecars?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: undefined | undefined;
            maxPriorityFeePerGas?: undefined | undefined;
        } & {
            accessList: viem.TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
            blobVersionedHashes?: readonly `0x${string}`[] | undefined;
            maxFeePerBlobGas?: bigint | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
        } | {
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
            blobVersionedHashes?: readonly `0x${string}`[] | undefined;
            maxFeePerBlobGas?: bigint | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
        }) & (viem.ExactPartial<viem.FeeValuesEIP4844> & viem.OneOf<{
            blobs: viem.TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: viem.TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: viem.TransactionSerializableEIP4844["sidecars"];
        }, viem.TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: viem.AccessList | undefined;
            authorizationList?: viem.SignedAuthorizationList | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: undefined | undefined;
        } | {
            accessList?: viem.AccessList | undefined;
            authorizationList?: viem.SignedAuthorizationList | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: undefined | undefined;
        }) & {
            authorizationList: viem.TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string | undefined ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : viem.GetTransactionType<request, (request extends {
            accessList?: undefined | undefined;
            authorizationList?: undefined | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: bigint | undefined;
            sidecars?: undefined | undefined;
        } & viem.FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: undefined | undefined;
        } & (viem.OneOf<{
            maxFeePerGas: viem.FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: viem.FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, viem.FeeValuesEIP1559> & {
            accessList?: viem.TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: bigint | undefined;
            sidecars?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: undefined | undefined;
            maxPriorityFeePerGas?: undefined | undefined;
        } & {
            accessList: viem.TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
            blobVersionedHashes?: readonly `0x${string}`[] | undefined;
            maxFeePerBlobGas?: bigint | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
        } | {
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
            blobVersionedHashes?: readonly `0x${string}`[] | undefined;
            maxFeePerBlobGas?: bigint | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
        }) & (viem.ExactPartial<viem.FeeValuesEIP4844> & viem.OneOf<{
            blobs: viem.TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: viem.TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: viem.TransactionSerializableEIP4844["sidecars"];
        }, viem.TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: viem.AccessList | undefined;
            authorizationList?: viem.SignedAuthorizationList | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: undefined | undefined;
        } | {
            accessList?: viem.AccessList | undefined;
            authorizationList?: viem.SignedAuthorizationList | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: undefined | undefined;
        }) & {
            authorizationList: viem.TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string | undefined ? Extract<request["type"], string> : never)>) extends infer T_7 ? T_7 extends (request["type"] extends string ? request["type"] : viem.IsNever<viem.IsNever<Extract<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_8 ? T_8 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_8 extends object ? request extends viem.ExactPartial<T_8> ? T_8 extends {
            type?: infer type | undefined;
        } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>>> extends true ? Exclude<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_9 ? T_9 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_9 extends object ? request extends viem.ExactPartial<T_9> ? T_9 extends {
            type?: infer type | undefined;
        } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>> : never> extends false ? viem.IsNever<Extract<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_10 ? T_10 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_10 extends object ? request extends viem.ExactPartial<T_10> ? T_10 extends {
            type?: infer type | undefined;
        } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>>> extends true ? Exclude<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_11 ? T_11 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_11 extends object ? request extends viem.ExactPartial<T_11> ? T_11 extends {
            type?: infer type | undefined;
        } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>> : never : request["type"] extends string | undefined ? request["type"] : viem.GetTransactionType<request, (request extends {
            accessList?: undefined | undefined;
            authorizationList?: undefined | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: bigint | undefined;
            sidecars?: undefined | undefined;
        } & viem.FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: undefined | undefined;
        } & (viem.OneOf<{
            maxFeePerGas: viem.FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: viem.FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, viem.FeeValuesEIP1559> & {
            accessList?: viem.TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: bigint | undefined;
            sidecars?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: undefined | undefined;
            maxPriorityFeePerGas?: undefined | undefined;
        } & {
            accessList: viem.TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
            blobVersionedHashes?: readonly `0x${string}`[] | undefined;
            maxFeePerBlobGas?: bigint | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
        } | {
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
            blobVersionedHashes?: readonly `0x${string}`[] | undefined;
            maxFeePerBlobGas?: bigint | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
        }) & (viem.ExactPartial<viem.FeeValuesEIP4844> & viem.OneOf<{
            blobs: viem.TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: viem.TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: viem.TransactionSerializableEIP4844["sidecars"];
        }, viem.TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: viem.AccessList | undefined;
            authorizationList?: viem.SignedAuthorizationList | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: undefined | undefined;
        } | {
            accessList?: viem.AccessList | undefined;
            authorizationList?: viem.SignedAuthorizationList | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: undefined | undefined;
        }) & {
            authorizationList: viem.TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string | undefined ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : viem.GetTransactionType<request, (request extends {
            accessList?: undefined | undefined;
            authorizationList?: undefined | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: bigint | undefined;
            sidecars?: undefined | undefined;
        } & viem.FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: undefined | undefined;
        } & (viem.OneOf<{
            maxFeePerGas: viem.FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: viem.FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, viem.FeeValuesEIP1559> & {
            accessList?: viem.TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: bigint | undefined;
            sidecars?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: undefined | undefined;
            maxPriorityFeePerGas?: undefined | undefined;
        } & {
            accessList: viem.TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
            blobVersionedHashes?: readonly `0x${string}`[] | undefined;
            maxFeePerBlobGas?: bigint | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
        } | {
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
            blobVersionedHashes?: readonly `0x${string}`[] | undefined;
            maxFeePerBlobGas?: bigint | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
        }) & (viem.ExactPartial<viem.FeeValuesEIP4844> & viem.OneOf<{
            blobs: viem.TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: viem.TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: viem.TransactionSerializableEIP4844["sidecars"];
        }, viem.TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: viem.AccessList | undefined;
            authorizationList?: viem.SignedAuthorizationList | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: undefined | undefined;
        } | {
            accessList?: viem.AccessList | undefined;
            authorizationList?: viem.SignedAuthorizationList | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: undefined | undefined;
        }) & {
            authorizationList: viem.TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string | undefined ? Extract<request["type"], string> : never)>) ? T_7 extends string ? T_7 : undefined : never : never) | undefined;
    }, viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from">, ((request["type"] extends string ? request["type"] : viem.IsNever<viem.IsNever<Extract<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_12 ? T_12 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_12 extends object ? request extends viem.ExactPartial<T_12> ? T_12 extends {
        type?: infer type | undefined;
    } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>>> extends true ? Exclude<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_13 ? T_13 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_13 extends object ? request extends viem.ExactPartial<T_13> ? T_13 extends {
        type?: infer type | undefined;
    } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>> : never> extends false ? viem.IsNever<Extract<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_14 ? T_14 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_14 extends object ? request extends viem.ExactPartial<T_14> ? T_14 extends {
        type?: infer type | undefined;
    } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>>> extends true ? Exclude<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_15 ? T_15 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_15 extends object ? request extends viem.ExactPartial<T_15> ? T_15 extends {
        type?: infer type | undefined;
    } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>> : never : request["type"] extends string | undefined ? request["type"] : viem.GetTransactionType<request, (request extends {
        accessList?: undefined | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: bigint | undefined;
        sidecars?: undefined | undefined;
    } & viem.FeeValuesLegacy ? "legacy" : never) | (request extends {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    } & (viem.OneOf<{
        maxFeePerGas: viem.FeeValuesEIP1559["maxFeePerGas"];
    } | {
        maxPriorityFeePerGas: viem.FeeValuesEIP1559["maxPriorityFeePerGas"];
    }, viem.FeeValuesEIP1559> & {
        accessList?: viem.TransactionSerializableEIP2930["accessList"] | undefined;
    }) ? "eip1559" : never) | (request extends {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: bigint | undefined;
        sidecars?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: undefined | undefined;
        maxPriorityFeePerGas?: undefined | undefined;
    } & {
        accessList: viem.TransactionSerializableEIP2930["accessList"];
    } ? "eip2930" : never) | (request extends ({
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
        blobVersionedHashes?: readonly `0x${string}`[] | undefined;
        maxFeePerBlobGas?: bigint | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
    } | {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
        blobVersionedHashes?: readonly `0x${string}`[] | undefined;
        maxFeePerBlobGas?: bigint | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
    }) & (viem.ExactPartial<viem.FeeValuesEIP4844> & viem.OneOf<{
        blobs: viem.TransactionSerializableEIP4844["blobs"];
    } | {
        blobVersionedHashes: viem.TransactionSerializableEIP4844["blobVersionedHashes"];
    } | {
        sidecars: viem.TransactionSerializableEIP4844["sidecars"];
    }, viem.TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
        accessList?: viem.AccessList | undefined;
        authorizationList?: viem.SignedAuthorizationList | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    } | {
        accessList?: viem.AccessList | undefined;
        authorizationList?: viem.SignedAuthorizationList | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    }) & {
        authorizationList: viem.TransactionSerializableEIP7702["authorizationList"];
    } ? "eip7702" : never) | (request["type"] extends string | undefined ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : viem.GetTransactionType<request, (request extends {
        accessList?: undefined | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: bigint | undefined;
        sidecars?: undefined | undefined;
    } & viem.FeeValuesLegacy ? "legacy" : never) | (request extends {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    } & (viem.OneOf<{
        maxFeePerGas: viem.FeeValuesEIP1559["maxFeePerGas"];
    } | {
        maxPriorityFeePerGas: viem.FeeValuesEIP1559["maxPriorityFeePerGas"];
    }, viem.FeeValuesEIP1559> & {
        accessList?: viem.TransactionSerializableEIP2930["accessList"] | undefined;
    }) ? "eip1559" : never) | (request extends {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: bigint | undefined;
        sidecars?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: undefined | undefined;
        maxPriorityFeePerGas?: undefined | undefined;
    } & {
        accessList: viem.TransactionSerializableEIP2930["accessList"];
    } ? "eip2930" : never) | (request extends ({
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
        blobVersionedHashes?: readonly `0x${string}`[] | undefined;
        maxFeePerBlobGas?: bigint | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
    } | {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
        blobVersionedHashes?: readonly `0x${string}`[] | undefined;
        maxFeePerBlobGas?: bigint | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
    }) & (viem.ExactPartial<viem.FeeValuesEIP4844> & viem.OneOf<{
        blobs: viem.TransactionSerializableEIP4844["blobs"];
    } | {
        blobVersionedHashes: viem.TransactionSerializableEIP4844["blobVersionedHashes"];
    } | {
        sidecars: viem.TransactionSerializableEIP4844["sidecars"];
    }, viem.TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
        accessList?: viem.AccessList | undefined;
        authorizationList?: viem.SignedAuthorizationList | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    } | {
        accessList?: viem.AccessList | undefined;
        authorizationList?: viem.SignedAuthorizationList | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    }) & {
        authorizationList: viem.TransactionSerializableEIP7702["authorizationList"];
    } ? "eip7702" : never) | (request["type"] extends string | undefined ? Extract<request["type"], string> : never)>) extends infer T_16 ? T_16 extends (request["type"] extends string ? request["type"] : viem.IsNever<viem.IsNever<Extract<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_17 ? T_17 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_17 extends object ? request extends viem.ExactPartial<T_17> ? T_17 extends {
        type?: infer type | undefined;
    } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>>> extends true ? Exclude<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_18 ? T_18 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_18 extends object ? request extends viem.ExactPartial<T_18> ? T_18 extends {
        type?: infer type | undefined;
    } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>> : never> extends false ? viem.IsNever<Extract<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_19 ? T_19 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_19 extends object ? request extends viem.ExactPartial<T_19> ? T_19 extends {
        type?: infer type | undefined;
    } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>>> extends true ? Exclude<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_20 ? T_20 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_20 extends object ? request extends viem.ExactPartial<T_20> ? T_20 extends {
        type?: infer type | undefined;
    } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>> : never : request["type"] extends string | undefined ? request["type"] : viem.GetTransactionType<request, (request extends {
        accessList?: undefined | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: bigint | undefined;
        sidecars?: undefined | undefined;
    } & viem.FeeValuesLegacy ? "legacy" : never) | (request extends {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    } & (viem.OneOf<{
        maxFeePerGas: viem.FeeValuesEIP1559["maxFeePerGas"];
    } | {
        maxPriorityFeePerGas: viem.FeeValuesEIP1559["maxPriorityFeePerGas"];
    }, viem.FeeValuesEIP1559> & {
        accessList?: viem.TransactionSerializableEIP2930["accessList"] | undefined;
    }) ? "eip1559" : never) | (request extends {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: bigint | undefined;
        sidecars?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: undefined | undefined;
        maxPriorityFeePerGas?: undefined | undefined;
    } & {
        accessList: viem.TransactionSerializableEIP2930["accessList"];
    } ? "eip2930" : never) | (request extends ({
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
        blobVersionedHashes?: readonly `0x${string}`[] | undefined;
        maxFeePerBlobGas?: bigint | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
    } | {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
        blobVersionedHashes?: readonly `0x${string}`[] | undefined;
        maxFeePerBlobGas?: bigint | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
    }) & (viem.ExactPartial<viem.FeeValuesEIP4844> & viem.OneOf<{
        blobs: viem.TransactionSerializableEIP4844["blobs"];
    } | {
        blobVersionedHashes: viem.TransactionSerializableEIP4844["blobVersionedHashes"];
    } | {
        sidecars: viem.TransactionSerializableEIP4844["sidecars"];
    }, viem.TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
        accessList?: viem.AccessList | undefined;
        authorizationList?: viem.SignedAuthorizationList | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    } | {
        accessList?: viem.AccessList | undefined;
        authorizationList?: viem.SignedAuthorizationList | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    }) & {
        authorizationList: viem.TransactionSerializableEIP7702["authorizationList"];
    } ? "eip7702" : never) | (request["type"] extends string | undefined ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : viem.GetTransactionType<request, (request extends {
        accessList?: undefined | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: bigint | undefined;
        sidecars?: undefined | undefined;
    } & viem.FeeValuesLegacy ? "legacy" : never) | (request extends {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    } & (viem.OneOf<{
        maxFeePerGas: viem.FeeValuesEIP1559["maxFeePerGas"];
    } | {
        maxPriorityFeePerGas: viem.FeeValuesEIP1559["maxPriorityFeePerGas"];
    }, viem.FeeValuesEIP1559> & {
        accessList?: viem.TransactionSerializableEIP2930["accessList"] | undefined;
    }) ? "eip1559" : never) | (request extends {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: bigint | undefined;
        sidecars?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: undefined | undefined;
        maxPriorityFeePerGas?: undefined | undefined;
    } & {
        accessList: viem.TransactionSerializableEIP2930["accessList"];
    } ? "eip2930" : never) | (request extends ({
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
        blobVersionedHashes?: readonly `0x${string}`[] | undefined;
        maxFeePerBlobGas?: bigint | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
    } | {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
        blobVersionedHashes?: readonly `0x${string}`[] | undefined;
        maxFeePerBlobGas?: bigint | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
    }) & (viem.ExactPartial<viem.FeeValuesEIP4844> & viem.OneOf<{
        blobs: viem.TransactionSerializableEIP4844["blobs"];
    } | {
        blobVersionedHashes: viem.TransactionSerializableEIP4844["blobVersionedHashes"];
    } | {
        sidecars: viem.TransactionSerializableEIP4844["sidecars"];
    }, viem.TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
        accessList?: viem.AccessList | undefined;
        authorizationList?: viem.SignedAuthorizationList | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    } | {
        accessList?: viem.AccessList | undefined;
        authorizationList?: viem.SignedAuthorizationList | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    }) & {
        authorizationList: viem.TransactionSerializableEIP7702["authorizationList"];
    } ? "eip7702" : never) | (request["type"] extends string | undefined ? Extract<request["type"], string> : never)>) ? T_16 extends string ? T_16 : undefined : never : never) | undefined>> extends true ? unknown : viem.ExactPartial<viem.ExtractFormattedTransactionRequest<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, {
        type?: ((request["type"] extends string ? request["type"] : viem.IsNever<viem.IsNever<Extract<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_21 ? T_21 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_21 extends object ? request extends viem.ExactPartial<T_21> ? T_21 extends {
            type?: infer type | undefined;
        } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>>> extends true ? Exclude<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_22 ? T_22 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_22 extends object ? request extends viem.ExactPartial<T_22> ? T_22 extends {
            type?: infer type | undefined;
        } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>> : never> extends false ? viem.IsNever<Extract<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_23 ? T_23 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_23 extends object ? request extends viem.ExactPartial<T_23> ? T_23 extends {
            type?: infer type | undefined;
        } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>>> extends true ? Exclude<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_24 ? T_24 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_24 extends object ? request extends viem.ExactPartial<T_24> ? T_24 extends {
            type?: infer type | undefined;
        } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>> : never : request["type"] extends string | undefined ? request["type"] : viem.GetTransactionType<request, (request extends {
            accessList?: undefined | undefined;
            authorizationList?: undefined | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: bigint | undefined;
            sidecars?: undefined | undefined;
        } & viem.FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: undefined | undefined;
        } & (viem.OneOf<{
            maxFeePerGas: viem.FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: viem.FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, viem.FeeValuesEIP1559> & {
            accessList?: viem.TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: bigint | undefined;
            sidecars?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: undefined | undefined;
            maxPriorityFeePerGas?: undefined | undefined;
        } & {
            accessList: viem.TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
            blobVersionedHashes?: readonly `0x${string}`[] | undefined;
            maxFeePerBlobGas?: bigint | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
        } | {
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
            blobVersionedHashes?: readonly `0x${string}`[] | undefined;
            maxFeePerBlobGas?: bigint | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
        }) & (viem.ExactPartial<viem.FeeValuesEIP4844> & viem.OneOf<{
            blobs: viem.TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: viem.TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: viem.TransactionSerializableEIP4844["sidecars"];
        }, viem.TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: viem.AccessList | undefined;
            authorizationList?: viem.SignedAuthorizationList | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: undefined | undefined;
        } | {
            accessList?: viem.AccessList | undefined;
            authorizationList?: viem.SignedAuthorizationList | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: undefined | undefined;
        }) & {
            authorizationList: viem.TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string | undefined ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : viem.GetTransactionType<request, (request extends {
            accessList?: undefined | undefined;
            authorizationList?: undefined | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: bigint | undefined;
            sidecars?: undefined | undefined;
        } & viem.FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: undefined | undefined;
        } & (viem.OneOf<{
            maxFeePerGas: viem.FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: viem.FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, viem.FeeValuesEIP1559> & {
            accessList?: viem.TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: bigint | undefined;
            sidecars?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: undefined | undefined;
            maxPriorityFeePerGas?: undefined | undefined;
        } & {
            accessList: viem.TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
            blobVersionedHashes?: readonly `0x${string}`[] | undefined;
            maxFeePerBlobGas?: bigint | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
        } | {
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
            blobVersionedHashes?: readonly `0x${string}`[] | undefined;
            maxFeePerBlobGas?: bigint | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
        }) & (viem.ExactPartial<viem.FeeValuesEIP4844> & viem.OneOf<{
            blobs: viem.TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: viem.TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: viem.TransactionSerializableEIP4844["sidecars"];
        }, viem.TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: viem.AccessList | undefined;
            authorizationList?: viem.SignedAuthorizationList | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: undefined | undefined;
        } | {
            accessList?: viem.AccessList | undefined;
            authorizationList?: viem.SignedAuthorizationList | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: undefined | undefined;
        }) & {
            authorizationList: viem.TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string | undefined ? Extract<request["type"], string> : never)>) extends infer T_25 ? T_25 extends (request["type"] extends string ? request["type"] : viem.IsNever<viem.IsNever<Extract<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_26 ? T_26 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_26 extends object ? request extends viem.ExactPartial<T_26> ? T_26 extends {
            type?: infer type | undefined;
        } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>>> extends true ? Exclude<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_27 ? T_27 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_27 extends object ? request extends viem.ExactPartial<T_27> ? T_27 extends {
            type?: infer type | undefined;
        } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>> : never> extends false ? viem.IsNever<Extract<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_28 ? T_28 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_28 extends object ? request extends viem.ExactPartial<T_28> ? T_28 extends {
            type?: infer type | undefined;
        } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>>> extends true ? Exclude<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_29 ? T_29 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_29 extends object ? request extends viem.ExactPartial<T_29> ? T_29 extends {
            type?: infer type | undefined;
        } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>> : never : request["type"] extends string | undefined ? request["type"] : viem.GetTransactionType<request, (request extends {
            accessList?: undefined | undefined;
            authorizationList?: undefined | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: bigint | undefined;
            sidecars?: undefined | undefined;
        } & viem.FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: undefined | undefined;
        } & (viem.OneOf<{
            maxFeePerGas: viem.FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: viem.FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, viem.FeeValuesEIP1559> & {
            accessList?: viem.TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: bigint | undefined;
            sidecars?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: undefined | undefined;
            maxPriorityFeePerGas?: undefined | undefined;
        } & {
            accessList: viem.TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
            blobVersionedHashes?: readonly `0x${string}`[] | undefined;
            maxFeePerBlobGas?: bigint | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
        } | {
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
            blobVersionedHashes?: readonly `0x${string}`[] | undefined;
            maxFeePerBlobGas?: bigint | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
        }) & (viem.ExactPartial<viem.FeeValuesEIP4844> & viem.OneOf<{
            blobs: viem.TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: viem.TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: viem.TransactionSerializableEIP4844["sidecars"];
        }, viem.TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: viem.AccessList | undefined;
            authorizationList?: viem.SignedAuthorizationList | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: undefined | undefined;
        } | {
            accessList?: viem.AccessList | undefined;
            authorizationList?: viem.SignedAuthorizationList | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: undefined | undefined;
        }) & {
            authorizationList: viem.TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string | undefined ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : viem.GetTransactionType<request, (request extends {
            accessList?: undefined | undefined;
            authorizationList?: undefined | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: bigint | undefined;
            sidecars?: undefined | undefined;
        } & viem.FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: undefined | undefined;
        } & (viem.OneOf<{
            maxFeePerGas: viem.FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: viem.FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, viem.FeeValuesEIP1559> & {
            accessList?: viem.TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: bigint | undefined;
            sidecars?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: undefined | undefined;
            maxPriorityFeePerGas?: undefined | undefined;
        } & {
            accessList: viem.TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
            blobVersionedHashes?: readonly `0x${string}`[] | undefined;
            maxFeePerBlobGas?: bigint | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
        } | {
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
            blobVersionedHashes?: readonly `0x${string}`[] | undefined;
            maxFeePerBlobGas?: bigint | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
        }) & (viem.ExactPartial<viem.FeeValuesEIP4844> & viem.OneOf<{
            blobs: viem.TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: viem.TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: viem.TransactionSerializableEIP4844["sidecars"];
        }, viem.TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: viem.AccessList | undefined;
            authorizationList?: viem.SignedAuthorizationList | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: undefined | undefined;
        } | {
            accessList?: viem.AccessList | undefined;
            authorizationList?: viem.SignedAuthorizationList | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: undefined | undefined;
        }) & {
            authorizationList: viem.TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string | undefined ? Extract<request["type"], string> : never)>) ? T_25 extends string ? T_25 : undefined : never : never) | undefined;
    }, viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from">, ((request["type"] extends string ? request["type"] : viem.IsNever<viem.IsNever<Extract<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_30 ? T_30 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_30 extends object ? request extends viem.ExactPartial<T_30> ? T_30 extends {
        type?: infer type | undefined;
    } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>>> extends true ? Exclude<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_31 ? T_31 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_31 extends object ? request extends viem.ExactPartial<T_31> ? T_31 extends {
        type?: infer type | undefined;
    } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>> : never> extends false ? viem.IsNever<Extract<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_32 ? T_32 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_32 extends object ? request extends viem.ExactPartial<T_32> ? T_32 extends {
        type?: infer type | undefined;
    } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>>> extends true ? Exclude<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_33 ? T_33 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_33 extends object ? request extends viem.ExactPartial<T_33> ? T_33 extends {
        type?: infer type | undefined;
    } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>> : never : request["type"] extends string | undefined ? request["type"] : viem.GetTransactionType<request, (request extends {
        accessList?: undefined | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: bigint | undefined;
        sidecars?: undefined | undefined;
    } & viem.FeeValuesLegacy ? "legacy" : never) | (request extends {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    } & (viem.OneOf<{
        maxFeePerGas: viem.FeeValuesEIP1559["maxFeePerGas"];
    } | {
        maxPriorityFeePerGas: viem.FeeValuesEIP1559["maxPriorityFeePerGas"];
    }, viem.FeeValuesEIP1559> & {
        accessList?: viem.TransactionSerializableEIP2930["accessList"] | undefined;
    }) ? "eip1559" : never) | (request extends {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: bigint | undefined;
        sidecars?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: undefined | undefined;
        maxPriorityFeePerGas?: undefined | undefined;
    } & {
        accessList: viem.TransactionSerializableEIP2930["accessList"];
    } ? "eip2930" : never) | (request extends ({
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
        blobVersionedHashes?: readonly `0x${string}`[] | undefined;
        maxFeePerBlobGas?: bigint | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
    } | {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
        blobVersionedHashes?: readonly `0x${string}`[] | undefined;
        maxFeePerBlobGas?: bigint | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
    }) & (viem.ExactPartial<viem.FeeValuesEIP4844> & viem.OneOf<{
        blobs: viem.TransactionSerializableEIP4844["blobs"];
    } | {
        blobVersionedHashes: viem.TransactionSerializableEIP4844["blobVersionedHashes"];
    } | {
        sidecars: viem.TransactionSerializableEIP4844["sidecars"];
    }, viem.TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
        accessList?: viem.AccessList | undefined;
        authorizationList?: viem.SignedAuthorizationList | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    } | {
        accessList?: viem.AccessList | undefined;
        authorizationList?: viem.SignedAuthorizationList | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    }) & {
        authorizationList: viem.TransactionSerializableEIP7702["authorizationList"];
    } ? "eip7702" : never) | (request["type"] extends string | undefined ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : viem.GetTransactionType<request, (request extends {
        accessList?: undefined | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: bigint | undefined;
        sidecars?: undefined | undefined;
    } & viem.FeeValuesLegacy ? "legacy" : never) | (request extends {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    } & (viem.OneOf<{
        maxFeePerGas: viem.FeeValuesEIP1559["maxFeePerGas"];
    } | {
        maxPriorityFeePerGas: viem.FeeValuesEIP1559["maxPriorityFeePerGas"];
    }, viem.FeeValuesEIP1559> & {
        accessList?: viem.TransactionSerializableEIP2930["accessList"] | undefined;
    }) ? "eip1559" : never) | (request extends {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: bigint | undefined;
        sidecars?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: undefined | undefined;
        maxPriorityFeePerGas?: undefined | undefined;
    } & {
        accessList: viem.TransactionSerializableEIP2930["accessList"];
    } ? "eip2930" : never) | (request extends ({
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
        blobVersionedHashes?: readonly `0x${string}`[] | undefined;
        maxFeePerBlobGas?: bigint | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
    } | {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
        blobVersionedHashes?: readonly `0x${string}`[] | undefined;
        maxFeePerBlobGas?: bigint | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
    }) & (viem.ExactPartial<viem.FeeValuesEIP4844> & viem.OneOf<{
        blobs: viem.TransactionSerializableEIP4844["blobs"];
    } | {
        blobVersionedHashes: viem.TransactionSerializableEIP4844["blobVersionedHashes"];
    } | {
        sidecars: viem.TransactionSerializableEIP4844["sidecars"];
    }, viem.TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
        accessList?: viem.AccessList | undefined;
        authorizationList?: viem.SignedAuthorizationList | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    } | {
        accessList?: viem.AccessList | undefined;
        authorizationList?: viem.SignedAuthorizationList | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    }) & {
        authorizationList: viem.TransactionSerializableEIP7702["authorizationList"];
    } ? "eip7702" : never) | (request["type"] extends string | undefined ? Extract<request["type"], string> : never)>) extends infer T_34 ? T_34 extends (request["type"] extends string ? request["type"] : viem.IsNever<viem.IsNever<Extract<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_35 ? T_35 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_35 extends object ? request extends viem.ExactPartial<T_35> ? T_35 extends {
        type?: infer type | undefined;
    } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>>> extends true ? Exclude<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_36 ? T_36 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_36 extends object ? request extends viem.ExactPartial<T_36> ? T_36 extends {
        type?: infer type | undefined;
    } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>> : never> extends false ? viem.IsNever<Extract<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_37 ? T_37 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_37 extends object ? request extends viem.ExactPartial<T_37> ? T_37 extends {
        type?: infer type | undefined;
    } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>>> extends true ? Exclude<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_38 ? T_38 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_38 extends object ? request extends viem.ExactPartial<T_38> ? T_38 extends {
        type?: infer type | undefined;
    } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>> : never : request["type"] extends string | undefined ? request["type"] : viem.GetTransactionType<request, (request extends {
        accessList?: undefined | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: bigint | undefined;
        sidecars?: undefined | undefined;
    } & viem.FeeValuesLegacy ? "legacy" : never) | (request extends {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    } & (viem.OneOf<{
        maxFeePerGas: viem.FeeValuesEIP1559["maxFeePerGas"];
    } | {
        maxPriorityFeePerGas: viem.FeeValuesEIP1559["maxPriorityFeePerGas"];
    }, viem.FeeValuesEIP1559> & {
        accessList?: viem.TransactionSerializableEIP2930["accessList"] | undefined;
    }) ? "eip1559" : never) | (request extends {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: bigint | undefined;
        sidecars?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: undefined | undefined;
        maxPriorityFeePerGas?: undefined | undefined;
    } & {
        accessList: viem.TransactionSerializableEIP2930["accessList"];
    } ? "eip2930" : never) | (request extends ({
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
        blobVersionedHashes?: readonly `0x${string}`[] | undefined;
        maxFeePerBlobGas?: bigint | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
    } | {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
        blobVersionedHashes?: readonly `0x${string}`[] | undefined;
        maxFeePerBlobGas?: bigint | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
    }) & (viem.ExactPartial<viem.FeeValuesEIP4844> & viem.OneOf<{
        blobs: viem.TransactionSerializableEIP4844["blobs"];
    } | {
        blobVersionedHashes: viem.TransactionSerializableEIP4844["blobVersionedHashes"];
    } | {
        sidecars: viem.TransactionSerializableEIP4844["sidecars"];
    }, viem.TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
        accessList?: viem.AccessList | undefined;
        authorizationList?: viem.SignedAuthorizationList | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    } | {
        accessList?: viem.AccessList | undefined;
        authorizationList?: viem.SignedAuthorizationList | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    }) & {
        authorizationList: viem.TransactionSerializableEIP7702["authorizationList"];
    } ? "eip7702" : never) | (request["type"] extends string | undefined ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : viem.GetTransactionType<request, (request extends {
        accessList?: undefined | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: bigint | undefined;
        sidecars?: undefined | undefined;
    } & viem.FeeValuesLegacy ? "legacy" : never) | (request extends {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    } & (viem.OneOf<{
        maxFeePerGas: viem.FeeValuesEIP1559["maxFeePerGas"];
    } | {
        maxPriorityFeePerGas: viem.FeeValuesEIP1559["maxPriorityFeePerGas"];
    }, viem.FeeValuesEIP1559> & {
        accessList?: viem.TransactionSerializableEIP2930["accessList"] | undefined;
    }) ? "eip1559" : never) | (request extends {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: bigint | undefined;
        sidecars?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: undefined | undefined;
        maxPriorityFeePerGas?: undefined | undefined;
    } & {
        accessList: viem.TransactionSerializableEIP2930["accessList"];
    } ? "eip2930" : never) | (request extends ({
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
        blobVersionedHashes?: readonly `0x${string}`[] | undefined;
        maxFeePerBlobGas?: bigint | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
    } | {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
        blobVersionedHashes?: readonly `0x${string}`[] | undefined;
        maxFeePerBlobGas?: bigint | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
    }) & (viem.ExactPartial<viem.FeeValuesEIP4844> & viem.OneOf<{
        blobs: viem.TransactionSerializableEIP4844["blobs"];
    } | {
        blobVersionedHashes: viem.TransactionSerializableEIP4844["blobVersionedHashes"];
    } | {
        sidecars: viem.TransactionSerializableEIP4844["sidecars"];
    }, viem.TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
        accessList?: viem.AccessList | undefined;
        authorizationList?: viem.SignedAuthorizationList | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    } | {
        accessList?: viem.AccessList | undefined;
        authorizationList?: viem.SignedAuthorizationList | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    }) & {
        authorizationList: viem.TransactionSerializableEIP7702["authorizationList"];
    } ? "eip7702" : never) | (request["type"] extends string | undefined ? Extract<request["type"], string> : never)>) ? T_34 extends string ? T_34 : undefined : never : never) | undefined>>> & {
        chainId?: number | undefined;
    }, (request["parameters"] extends readonly viem.PrepareTransactionRequestParameterType[] ? request["parameters"][number] : "chainId" | "fees" | "gas" | "nonce" | "blobVersionedHashes" | "type") extends infer T_39 ? T_39 extends (request["parameters"] extends readonly viem.PrepareTransactionRequestParameterType[] ? request["parameters"][number] : "chainId" | "fees" | "gas" | "nonce" | "blobVersionedHashes" | "type") ? T_39 extends "fees" ? "gasPrice" | "maxFeePerGas" | "maxPriorityFeePerGas" : T_39 : never : never> & (unknown extends request["kzg"] ? {} : Pick<request, "kzg">) & {
        _capabilities?: {
            [x: string]: any;
        } | undefined;
    } extends infer T ? { [K in keyof T]: T[K]; } : never>;
    readContract: <const abi extends viem.Abi | readonly unknown[], functionName extends viem.ContractFunctionName<abi, "pure" | "view">, const args extends viem.ContractFunctionArgs<abi, "pure" | "view", functionName>>(args: viem.ReadContractParameters<abi, functionName, args>) => Promise<viem.ReadContractReturnType<abi, functionName, args>>;
    sendRawTransaction: (args: viem.SendRawTransactionParameters) => Promise<viem.SendRawTransactionReturnType>;
    sendRawTransactionSync: (args: viem.SendRawTransactionSyncParameters) => Promise<viem.TransactionReceipt>;
    simulate: <const calls extends readonly unknown[]>(args: viem.SimulateBlocksParameters<calls>) => Promise<viem.SimulateBlocksReturnType<calls>>;
    simulateBlocks: <const calls extends readonly unknown[]>(args: viem.SimulateBlocksParameters<calls>) => Promise<viem.SimulateBlocksReturnType<calls>>;
    simulateCalls: <const calls extends readonly unknown[]>(args: viem.SimulateCallsParameters<calls>) => Promise<viem.SimulateCallsReturnType<calls>>;
    simulateContract: <const abi extends viem.Abi | readonly unknown[], functionName extends viem.ContractFunctionName<abi, "nonpayable" | "payable">, const args_1 extends viem.ContractFunctionArgs<abi, "nonpayable" | "payable", functionName>, chainOverride extends viem.Chain | undefined, accountOverride extends viem.Account | viem.Address | undefined = undefined>(args: viem.SimulateContractParameters<abi, functionName, args_1, {
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride, accountOverride>) => Promise<viem.SimulateContractReturnType<abi, functionName, args_1, {
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, undefined, chainOverride, accountOverride>>;
    verifyHash: (args: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>;
    verifyMessage: (args: viem.VerifyMessageActionParameters) => Promise<viem.VerifyMessageActionReturnType>;
    verifySiweMessage: (args: VerifySiweMessageParameters) => Promise<VerifySiweMessageReturnType>;
    verifyTypedData: (args: viem.VerifyTypedDataActionParameters) => Promise<viem.VerifyTypedDataActionReturnType>;
    uninstallFilter: (args: viem.UninstallFilterParameters) => Promise<viem.UninstallFilterReturnType>;
    waitForTransactionReceipt: (args: viem.WaitForTransactionReceiptParameters<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }>) => Promise<viem.TransactionReceipt>;
    watchBlockNumber: (args: viem.WatchBlockNumberParameters) => viem.WatchBlockNumberReturnType;
    watchBlocks: <includeTransactions extends boolean = false, blockTag extends viem.BlockTag = "latest">(args: viem.WatchBlocksParameters<viem.HttpTransport<undefined, false>, {
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, includeTransactions, blockTag>) => viem.WatchBlocksReturnType;
    watchContractEvent: <const abi extends viem.Abi | readonly unknown[], eventName extends viem.ContractEventName<abi>, strict extends boolean | undefined = undefined>(args: viem.WatchContractEventParameters<abi, eventName, strict, viem.HttpTransport<undefined, false>>) => viem.WatchContractEventReturnType;
    watchEvent: <const abiEvent extends viem.AbiEvent | undefined = undefined, const abiEvents extends readonly viem.AbiEvent[] | readonly unknown[] | undefined = abiEvent extends viem.AbiEvent ? [abiEvent] : undefined, strict extends boolean | undefined = undefined>(args: viem.WatchEventParameters<abiEvent, abiEvents, strict, viem.HttpTransport<undefined, false>>) => viem.WatchEventReturnType;
    watchPendingTransactions: (args: viem.WatchPendingTransactionsParameters<viem.HttpTransport<undefined, false>>) => viem.WatchPendingTransactionsReturnType;
    token: {
        getAllowance: ((parameters: getAllowance.Parameters<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, undefined>) => Promise<getAllowance.ReturnValue>) & {
            call: (args: getAllowance.Args<{
                blockExplorers: {
                    readonly default: {
                        readonly name: "Coston2 Explorer";
                        readonly url: "https://coston2-explorer.flare.network";
                    };
                };
                blockTime?: number | undefined | undefined;
                contracts?: {
                    [x: string]: viem.ChainContract | {
                        [sourceId: number]: viem.ChainContract | undefined;
                    } | undefined;
                    ensRegistry?: viem.ChainContract | undefined;
                    ensUniversalResolver?: viem.ChainContract | undefined;
                    multicall3?: viem.ChainContract | undefined;
                    erc6492Verifier?: viem.ChainContract | undefined;
                } | undefined;
                ensTlds?: readonly string[] | undefined;
                id: 114;
                name: "Flare Coston2";
                nativeCurrency: {
                    readonly name: "Coston2 FLR";
                    readonly symbol: "C2FLR";
                    readonly decimals: 18;
                };
                experimental_preconfirmationTime?: number | undefined | undefined;
                rpcUrls: {
                    readonly default: {
                        readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                    };
                    readonly public: {
                        readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                    };
                };
                sourceId?: number | undefined | undefined;
                supportsTransactionReplacementDetection?: boolean | undefined | undefined;
                testnet?: boolean | undefined | undefined;
                custom?: Record<string, unknown> | undefined;
                extendSchema?: Record<string, unknown> | undefined;
                fees?: viem.ChainFees<undefined> | undefined;
                formatters?: undefined;
                prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                    client: viem.Client;
                    phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
                }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                    client: viem.Client;
                    phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
                }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                    runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
                }] | undefined;
                serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
                verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
            }, undefined>) => ReturnType<typeof getAllowance.call>;
        };
        getBalance: ((parameters: getBalance.Parameters<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, undefined, undefined>) => Promise<getBalance.ReturnValue>) & {
            call: (args: getBalance.Args<{
                blockExplorers: {
                    readonly default: {
                        readonly name: "Coston2 Explorer";
                        readonly url: "https://coston2-explorer.flare.network";
                    };
                };
                blockTime?: number | undefined | undefined;
                contracts?: {
                    [x: string]: viem.ChainContract | {
                        [sourceId: number]: viem.ChainContract | undefined;
                    } | undefined;
                    ensRegistry?: viem.ChainContract | undefined;
                    ensUniversalResolver?: viem.ChainContract | undefined;
                    multicall3?: viem.ChainContract | undefined;
                    erc6492Verifier?: viem.ChainContract | undefined;
                } | undefined;
                ensTlds?: readonly string[] | undefined;
                id: 114;
                name: "Flare Coston2";
                nativeCurrency: {
                    readonly name: "Coston2 FLR";
                    readonly symbol: "C2FLR";
                    readonly decimals: 18;
                };
                experimental_preconfirmationTime?: number | undefined | undefined;
                rpcUrls: {
                    readonly default: {
                        readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                    };
                    readonly public: {
                        readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                    };
                };
                sourceId?: number | undefined | undefined;
                supportsTransactionReplacementDetection?: boolean | undefined | undefined;
                testnet?: boolean | undefined | undefined;
                custom?: Record<string, unknown> | undefined;
                extendSchema?: Record<string, unknown> | undefined;
                fees?: viem.ChainFees<undefined> | undefined;
                formatters?: undefined;
                prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                    client: viem.Client;
                    phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
                }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                    client: viem.Client;
                    phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
                }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                    runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
                }] | undefined;
                serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
                verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
            }, undefined, undefined>) => ReturnType<typeof getBalance.call>;
        };
        getMetadata: (parameters: getMetadata.Parameters<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, undefined>) => Promise<getMetadata.ReturnValue>;
        getTotalSupply: ((parameters: getTotalSupply.Parameters<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, undefined>) => Promise<getTotalSupply.ReturnValue>) & {
            call: (args: getTotalSupply.Args<{
                blockExplorers: {
                    readonly default: {
                        readonly name: "Coston2 Explorer";
                        readonly url: "https://coston2-explorer.flare.network";
                    };
                };
                blockTime?: number | undefined | undefined;
                contracts?: {
                    [x: string]: viem.ChainContract | {
                        [sourceId: number]: viem.ChainContract | undefined;
                    } | undefined;
                    ensRegistry?: viem.ChainContract | undefined;
                    ensUniversalResolver?: viem.ChainContract | undefined;
                    multicall3?: viem.ChainContract | undefined;
                    erc6492Verifier?: viem.ChainContract | undefined;
                } | undefined;
                ensTlds?: readonly string[] | undefined;
                id: 114;
                name: "Flare Coston2";
                nativeCurrency: {
                    readonly name: "Coston2 FLR";
                    readonly symbol: "C2FLR";
                    readonly decimals: 18;
                };
                experimental_preconfirmationTime?: number | undefined | undefined;
                rpcUrls: {
                    readonly default: {
                        readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                    };
                    readonly public: {
                        readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                    };
                };
                sourceId?: number | undefined | undefined;
                supportsTransactionReplacementDetection?: boolean | undefined | undefined;
                testnet?: boolean | undefined | undefined;
                custom?: Record<string, unknown> | undefined;
                extendSchema?: Record<string, unknown> | undefined;
                fees?: viem.ChainFees<undefined> | undefined;
                formatters?: undefined;
                prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                    client: viem.Client;
                    phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
                }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                    client: viem.Client;
                    phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
                }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                    runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
                }] | undefined;
                serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
                verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
            }, undefined>) => ReturnType<typeof getTotalSupply.call>;
        };
    };
    extend: <const client extends {
        [x: string]: unknown;
        account?: undefined;
        batch?: undefined;
        cacheTime?: undefined;
        ccipRead?: undefined;
        chain?: undefined;
        dataSuffix?: undefined;
        experimental_blockTag?: undefined;
        key?: undefined;
        name?: undefined;
        pollingInterval?: undefined;
        request?: undefined;
        tokens?: undefined;
        transport?: undefined;
        type?: undefined;
        uid?: undefined;
    } & viem.ExactPartial<Pick<viem.PublicActions<viem.HttpTransport<undefined, false>, {
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, undefined, undefined>, "prepareTransactionRequest" | "call" | "createContractEventFilter" | "createEventFilter" | "estimateContractGas" | "estimateGas" | "getBlock" | "getBlockNumber" | "getChainId" | "getContractEvents" | "getEnsText" | "getFilterChanges" | "getGasPrice" | "getLogs" | "getTransaction" | "getTransactionCount" | "getTransactionReceipt" | "readContract" | "sendRawTransaction" | "simulateContract" | "uninstallFilter" | "watchBlockNumber" | "watchContractEvent"> & Pick<viem.WalletActions<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, undefined, undefined>, "sendTransaction" | "writeContract">>>(fn: (client: viem.Client<viem.HttpTransport<undefined, false>, {
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, undefined, viem.PublicRpcSchema, viem.PublicActions<viem.HttpTransport<undefined, false>, {
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, undefined, undefined>, undefined>) => client) => viem.Client<viem.HttpTransport<undefined, false>, {
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, undefined, viem.PublicRpcSchema, { [K in keyof client]: client[K]; } & viem.PublicActions<viem.HttpTransport<undefined, false>, {
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, undefined, undefined>, undefined>;
};
declare function createBreezeWalletClient(provider: any): {
    account: undefined;
    batch?: {
        multicall?: boolean | viem.Prettify<viem.MulticallBatchOptions> | undefined;
    } | undefined;
    cacheTime: number;
    ccipRead?: false | {
        request?: (parameters: viem.CcipRequestParameters) => Promise<CcipRequestReturnType>;
    } | undefined;
    chain: {
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    };
    dataSuffix?: viem.DataSuffix | undefined;
    experimental_blockTag?: viem.BlockTag | undefined;
    key: string;
    name: string;
    pollingInterval: number;
    request: viem.EIP1193RequestFn<viem.WalletRpcSchema>;
    tokens: undefined;
    transport: viem.TransportConfig<"custom", viem.EIP1193RequestFn>;
    type: string;
    uid: string;
    addChain: (args: viem.AddChainParameters) => Promise<void>;
    deployContract: <const abi extends viem.Abi | readonly unknown[], chainOverride extends viem.Chain | undefined>(args: viem.DeployContractParameters<abi, {
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, undefined, chainOverride>) => Promise<viem.DeployContractReturnType>;
    fillTransaction: <chainOverride extends viem.Chain | undefined = undefined, accountOverride extends viem.Account | viem.Address | undefined = undefined>(args: viem.FillTransactionParameters<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, undefined, chainOverride, accountOverride>) => Promise<viem.FillTransactionReturnType<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>>;
    getAddresses: () => Promise<viem.GetAddressesReturnType>;
    getCallsStatus: (parameters: viem.GetCallsStatusParameters) => Promise<viem.GetCallsStatusReturnType>;
    getCapabilities: <chainId extends number | undefined>(parameters?: viem.GetCapabilitiesParameters<chainId>) => Promise<viem.GetCapabilitiesReturnType<chainId>>;
    getChainId: () => Promise<viem.GetChainIdReturnType>;
    getPermissions: () => Promise<viem.GetPermissionsReturnType>;
    prepareAuthorization: (parameters: viem.PrepareAuthorizationParameters<undefined>) => Promise<viem.PrepareAuthorizationReturnType>;
    prepareTransactionRequest: <const request extends viem.PrepareTransactionRequestRequest<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, chainOverride extends viem.Chain | undefined = undefined, accountOverride extends viem.Account | viem.Address | undefined = undefined>(args: viem.PrepareTransactionRequestParameters<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, undefined, chainOverride, accountOverride, request>) => Promise<viem.UnionRequiredBy<Extract<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> & (viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride> extends infer T_1 ? T_1 extends viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride> ? T_1 extends viem.Chain ? {
        chain: T_1;
    } : {
        chain?: undefined;
    } : never : never) & (viem.DeriveAccount<undefined, accountOverride> extends infer T_2 ? T_2 extends viem.DeriveAccount<undefined, accountOverride> ? T_2 extends viem.Account ? {
        account: T_2;
        from: viem.Address;
    } : {
        account?: undefined;
        from?: undefined;
    } : never : never), viem.IsNever<viem.ExtractFormattedTransactionRequest<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, {
        type?: ((request["type"] extends string ? request["type"] : viem.IsNever<viem.IsNever<Extract<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_3 ? T_3 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_3 extends object ? request extends viem.ExactPartial<T_3> ? T_3 extends {
            type?: infer type | undefined;
        } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>>> extends true ? Exclude<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_4 ? T_4 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_4 extends object ? request extends viem.ExactPartial<T_4> ? T_4 extends {
            type?: infer type | undefined;
        } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>> : never> extends false ? viem.IsNever<Extract<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_5 ? T_5 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_5 extends object ? request extends viem.ExactPartial<T_5> ? T_5 extends {
            type?: infer type | undefined;
        } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>>> extends true ? Exclude<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_6 ? T_6 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_6 extends object ? request extends viem.ExactPartial<T_6> ? T_6 extends {
            type?: infer type | undefined;
        } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>> : never : request["type"] extends string | undefined ? request["type"] : viem.GetTransactionType<request, (request extends {
            accessList?: undefined | undefined;
            authorizationList?: undefined | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: bigint | undefined;
            sidecars?: undefined | undefined;
        } & viem.FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: undefined | undefined;
        } & (viem.OneOf<{
            maxFeePerGas: viem.FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: viem.FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, viem.FeeValuesEIP1559> & {
            accessList?: viem.TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: bigint | undefined;
            sidecars?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: undefined | undefined;
            maxPriorityFeePerGas?: undefined | undefined;
        } & {
            accessList: viem.TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
            blobVersionedHashes?: readonly `0x${string}`[] | undefined;
            maxFeePerBlobGas?: bigint | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
        } | {
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
            blobVersionedHashes?: readonly `0x${string}`[] | undefined;
            maxFeePerBlobGas?: bigint | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
        }) & (viem.ExactPartial<viem.FeeValuesEIP4844> & viem.OneOf<{
            blobs: viem.TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: viem.TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: viem.TransactionSerializableEIP4844["sidecars"];
        }, viem.TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: viem.AccessList | undefined;
            authorizationList?: viem.SignedAuthorizationList | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: undefined | undefined;
        } | {
            accessList?: viem.AccessList | undefined;
            authorizationList?: viem.SignedAuthorizationList | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: undefined | undefined;
        }) & {
            authorizationList: viem.TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string | undefined ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : viem.GetTransactionType<request, (request extends {
            accessList?: undefined | undefined;
            authorizationList?: undefined | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: bigint | undefined;
            sidecars?: undefined | undefined;
        } & viem.FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: undefined | undefined;
        } & (viem.OneOf<{
            maxFeePerGas: viem.FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: viem.FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, viem.FeeValuesEIP1559> & {
            accessList?: viem.TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: bigint | undefined;
            sidecars?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: undefined | undefined;
            maxPriorityFeePerGas?: undefined | undefined;
        } & {
            accessList: viem.TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
            blobVersionedHashes?: readonly `0x${string}`[] | undefined;
            maxFeePerBlobGas?: bigint | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
        } | {
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
            blobVersionedHashes?: readonly `0x${string}`[] | undefined;
            maxFeePerBlobGas?: bigint | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
        }) & (viem.ExactPartial<viem.FeeValuesEIP4844> & viem.OneOf<{
            blobs: viem.TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: viem.TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: viem.TransactionSerializableEIP4844["sidecars"];
        }, viem.TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: viem.AccessList | undefined;
            authorizationList?: viem.SignedAuthorizationList | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: undefined | undefined;
        } | {
            accessList?: viem.AccessList | undefined;
            authorizationList?: viem.SignedAuthorizationList | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: undefined | undefined;
        }) & {
            authorizationList: viem.TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string | undefined ? Extract<request["type"], string> : never)>) extends infer T_7 ? T_7 extends (request["type"] extends string ? request["type"] : viem.IsNever<viem.IsNever<Extract<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_8 ? T_8 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_8 extends object ? request extends viem.ExactPartial<T_8> ? T_8 extends {
            type?: infer type | undefined;
        } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>>> extends true ? Exclude<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_9 ? T_9 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_9 extends object ? request extends viem.ExactPartial<T_9> ? T_9 extends {
            type?: infer type | undefined;
        } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>> : never> extends false ? viem.IsNever<Extract<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_10 ? T_10 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_10 extends object ? request extends viem.ExactPartial<T_10> ? T_10 extends {
            type?: infer type | undefined;
        } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>>> extends true ? Exclude<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_11 ? T_11 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_11 extends object ? request extends viem.ExactPartial<T_11> ? T_11 extends {
            type?: infer type | undefined;
        } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>> : never : request["type"] extends string | undefined ? request["type"] : viem.GetTransactionType<request, (request extends {
            accessList?: undefined | undefined;
            authorizationList?: undefined | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: bigint | undefined;
            sidecars?: undefined | undefined;
        } & viem.FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: undefined | undefined;
        } & (viem.OneOf<{
            maxFeePerGas: viem.FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: viem.FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, viem.FeeValuesEIP1559> & {
            accessList?: viem.TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: bigint | undefined;
            sidecars?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: undefined | undefined;
            maxPriorityFeePerGas?: undefined | undefined;
        } & {
            accessList: viem.TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
            blobVersionedHashes?: readonly `0x${string}`[] | undefined;
            maxFeePerBlobGas?: bigint | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
        } | {
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
            blobVersionedHashes?: readonly `0x${string}`[] | undefined;
            maxFeePerBlobGas?: bigint | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
        }) & (viem.ExactPartial<viem.FeeValuesEIP4844> & viem.OneOf<{
            blobs: viem.TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: viem.TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: viem.TransactionSerializableEIP4844["sidecars"];
        }, viem.TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: viem.AccessList | undefined;
            authorizationList?: viem.SignedAuthorizationList | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: undefined | undefined;
        } | {
            accessList?: viem.AccessList | undefined;
            authorizationList?: viem.SignedAuthorizationList | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: undefined | undefined;
        }) & {
            authorizationList: viem.TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string | undefined ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : viem.GetTransactionType<request, (request extends {
            accessList?: undefined | undefined;
            authorizationList?: undefined | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: bigint | undefined;
            sidecars?: undefined | undefined;
        } & viem.FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: undefined | undefined;
        } & (viem.OneOf<{
            maxFeePerGas: viem.FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: viem.FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, viem.FeeValuesEIP1559> & {
            accessList?: viem.TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: bigint | undefined;
            sidecars?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: undefined | undefined;
            maxPriorityFeePerGas?: undefined | undefined;
        } & {
            accessList: viem.TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
            blobVersionedHashes?: readonly `0x${string}`[] | undefined;
            maxFeePerBlobGas?: bigint | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
        } | {
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
            blobVersionedHashes?: readonly `0x${string}`[] | undefined;
            maxFeePerBlobGas?: bigint | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
        }) & (viem.ExactPartial<viem.FeeValuesEIP4844> & viem.OneOf<{
            blobs: viem.TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: viem.TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: viem.TransactionSerializableEIP4844["sidecars"];
        }, viem.TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: viem.AccessList | undefined;
            authorizationList?: viem.SignedAuthorizationList | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: undefined | undefined;
        } | {
            accessList?: viem.AccessList | undefined;
            authorizationList?: viem.SignedAuthorizationList | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: undefined | undefined;
        }) & {
            authorizationList: viem.TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string | undefined ? Extract<request["type"], string> : never)>) ? T_7 extends string ? T_7 : undefined : never : never) | undefined;
    }, viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from">, ((request["type"] extends string ? request["type"] : viem.IsNever<viem.IsNever<Extract<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_12 ? T_12 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_12 extends object ? request extends viem.ExactPartial<T_12> ? T_12 extends {
        type?: infer type | undefined;
    } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>>> extends true ? Exclude<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_13 ? T_13 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_13 extends object ? request extends viem.ExactPartial<T_13> ? T_13 extends {
        type?: infer type | undefined;
    } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>> : never> extends false ? viem.IsNever<Extract<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_14 ? T_14 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_14 extends object ? request extends viem.ExactPartial<T_14> ? T_14 extends {
        type?: infer type | undefined;
    } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>>> extends true ? Exclude<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_15 ? T_15 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_15 extends object ? request extends viem.ExactPartial<T_15> ? T_15 extends {
        type?: infer type | undefined;
    } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>> : never : request["type"] extends string | undefined ? request["type"] : viem.GetTransactionType<request, (request extends {
        accessList?: undefined | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: bigint | undefined;
        sidecars?: undefined | undefined;
    } & viem.FeeValuesLegacy ? "legacy" : never) | (request extends {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    } & (viem.OneOf<{
        maxFeePerGas: viem.FeeValuesEIP1559["maxFeePerGas"];
    } | {
        maxPriorityFeePerGas: viem.FeeValuesEIP1559["maxPriorityFeePerGas"];
    }, viem.FeeValuesEIP1559> & {
        accessList?: viem.TransactionSerializableEIP2930["accessList"] | undefined;
    }) ? "eip1559" : never) | (request extends {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: bigint | undefined;
        sidecars?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: undefined | undefined;
        maxPriorityFeePerGas?: undefined | undefined;
    } & {
        accessList: viem.TransactionSerializableEIP2930["accessList"];
    } ? "eip2930" : never) | (request extends ({
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
        blobVersionedHashes?: readonly `0x${string}`[] | undefined;
        maxFeePerBlobGas?: bigint | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
    } | {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
        blobVersionedHashes?: readonly `0x${string}`[] | undefined;
        maxFeePerBlobGas?: bigint | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
    }) & (viem.ExactPartial<viem.FeeValuesEIP4844> & viem.OneOf<{
        blobs: viem.TransactionSerializableEIP4844["blobs"];
    } | {
        blobVersionedHashes: viem.TransactionSerializableEIP4844["blobVersionedHashes"];
    } | {
        sidecars: viem.TransactionSerializableEIP4844["sidecars"];
    }, viem.TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
        accessList?: viem.AccessList | undefined;
        authorizationList?: viem.SignedAuthorizationList | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    } | {
        accessList?: viem.AccessList | undefined;
        authorizationList?: viem.SignedAuthorizationList | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    }) & {
        authorizationList: viem.TransactionSerializableEIP7702["authorizationList"];
    } ? "eip7702" : never) | (request["type"] extends string | undefined ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : viem.GetTransactionType<request, (request extends {
        accessList?: undefined | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: bigint | undefined;
        sidecars?: undefined | undefined;
    } & viem.FeeValuesLegacy ? "legacy" : never) | (request extends {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    } & (viem.OneOf<{
        maxFeePerGas: viem.FeeValuesEIP1559["maxFeePerGas"];
    } | {
        maxPriorityFeePerGas: viem.FeeValuesEIP1559["maxPriorityFeePerGas"];
    }, viem.FeeValuesEIP1559> & {
        accessList?: viem.TransactionSerializableEIP2930["accessList"] | undefined;
    }) ? "eip1559" : never) | (request extends {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: bigint | undefined;
        sidecars?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: undefined | undefined;
        maxPriorityFeePerGas?: undefined | undefined;
    } & {
        accessList: viem.TransactionSerializableEIP2930["accessList"];
    } ? "eip2930" : never) | (request extends ({
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
        blobVersionedHashes?: readonly `0x${string}`[] | undefined;
        maxFeePerBlobGas?: bigint | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
    } | {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
        blobVersionedHashes?: readonly `0x${string}`[] | undefined;
        maxFeePerBlobGas?: bigint | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
    }) & (viem.ExactPartial<viem.FeeValuesEIP4844> & viem.OneOf<{
        blobs: viem.TransactionSerializableEIP4844["blobs"];
    } | {
        blobVersionedHashes: viem.TransactionSerializableEIP4844["blobVersionedHashes"];
    } | {
        sidecars: viem.TransactionSerializableEIP4844["sidecars"];
    }, viem.TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
        accessList?: viem.AccessList | undefined;
        authorizationList?: viem.SignedAuthorizationList | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    } | {
        accessList?: viem.AccessList | undefined;
        authorizationList?: viem.SignedAuthorizationList | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    }) & {
        authorizationList: viem.TransactionSerializableEIP7702["authorizationList"];
    } ? "eip7702" : never) | (request["type"] extends string | undefined ? Extract<request["type"], string> : never)>) extends infer T_16 ? T_16 extends (request["type"] extends string ? request["type"] : viem.IsNever<viem.IsNever<Extract<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_17 ? T_17 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_17 extends object ? request extends viem.ExactPartial<T_17> ? T_17 extends {
        type?: infer type | undefined;
    } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>>> extends true ? Exclude<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_18 ? T_18 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_18 extends object ? request extends viem.ExactPartial<T_18> ? T_18 extends {
        type?: infer type | undefined;
    } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>> : never> extends false ? viem.IsNever<Extract<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_19 ? T_19 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_19 extends object ? request extends viem.ExactPartial<T_19> ? T_19 extends {
        type?: infer type | undefined;
    } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>>> extends true ? Exclude<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_20 ? T_20 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_20 extends object ? request extends viem.ExactPartial<T_20> ? T_20 extends {
        type?: infer type | undefined;
    } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>> : never : request["type"] extends string | undefined ? request["type"] : viem.GetTransactionType<request, (request extends {
        accessList?: undefined | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: bigint | undefined;
        sidecars?: undefined | undefined;
    } & viem.FeeValuesLegacy ? "legacy" : never) | (request extends {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    } & (viem.OneOf<{
        maxFeePerGas: viem.FeeValuesEIP1559["maxFeePerGas"];
    } | {
        maxPriorityFeePerGas: viem.FeeValuesEIP1559["maxPriorityFeePerGas"];
    }, viem.FeeValuesEIP1559> & {
        accessList?: viem.TransactionSerializableEIP2930["accessList"] | undefined;
    }) ? "eip1559" : never) | (request extends {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: bigint | undefined;
        sidecars?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: undefined | undefined;
        maxPriorityFeePerGas?: undefined | undefined;
    } & {
        accessList: viem.TransactionSerializableEIP2930["accessList"];
    } ? "eip2930" : never) | (request extends ({
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
        blobVersionedHashes?: readonly `0x${string}`[] | undefined;
        maxFeePerBlobGas?: bigint | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
    } | {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
        blobVersionedHashes?: readonly `0x${string}`[] | undefined;
        maxFeePerBlobGas?: bigint | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
    }) & (viem.ExactPartial<viem.FeeValuesEIP4844> & viem.OneOf<{
        blobs: viem.TransactionSerializableEIP4844["blobs"];
    } | {
        blobVersionedHashes: viem.TransactionSerializableEIP4844["blobVersionedHashes"];
    } | {
        sidecars: viem.TransactionSerializableEIP4844["sidecars"];
    }, viem.TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
        accessList?: viem.AccessList | undefined;
        authorizationList?: viem.SignedAuthorizationList | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    } | {
        accessList?: viem.AccessList | undefined;
        authorizationList?: viem.SignedAuthorizationList | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    }) & {
        authorizationList: viem.TransactionSerializableEIP7702["authorizationList"];
    } ? "eip7702" : never) | (request["type"] extends string | undefined ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : viem.GetTransactionType<request, (request extends {
        accessList?: undefined | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: bigint | undefined;
        sidecars?: undefined | undefined;
    } & viem.FeeValuesLegacy ? "legacy" : never) | (request extends {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    } & (viem.OneOf<{
        maxFeePerGas: viem.FeeValuesEIP1559["maxFeePerGas"];
    } | {
        maxPriorityFeePerGas: viem.FeeValuesEIP1559["maxPriorityFeePerGas"];
    }, viem.FeeValuesEIP1559> & {
        accessList?: viem.TransactionSerializableEIP2930["accessList"] | undefined;
    }) ? "eip1559" : never) | (request extends {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: bigint | undefined;
        sidecars?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: undefined | undefined;
        maxPriorityFeePerGas?: undefined | undefined;
    } & {
        accessList: viem.TransactionSerializableEIP2930["accessList"];
    } ? "eip2930" : never) | (request extends ({
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
        blobVersionedHashes?: readonly `0x${string}`[] | undefined;
        maxFeePerBlobGas?: bigint | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
    } | {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
        blobVersionedHashes?: readonly `0x${string}`[] | undefined;
        maxFeePerBlobGas?: bigint | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
    }) & (viem.ExactPartial<viem.FeeValuesEIP4844> & viem.OneOf<{
        blobs: viem.TransactionSerializableEIP4844["blobs"];
    } | {
        blobVersionedHashes: viem.TransactionSerializableEIP4844["blobVersionedHashes"];
    } | {
        sidecars: viem.TransactionSerializableEIP4844["sidecars"];
    }, viem.TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
        accessList?: viem.AccessList | undefined;
        authorizationList?: viem.SignedAuthorizationList | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    } | {
        accessList?: viem.AccessList | undefined;
        authorizationList?: viem.SignedAuthorizationList | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    }) & {
        authorizationList: viem.TransactionSerializableEIP7702["authorizationList"];
    } ? "eip7702" : never) | (request["type"] extends string | undefined ? Extract<request["type"], string> : never)>) ? T_16 extends string ? T_16 : undefined : never : never) | undefined>> extends true ? unknown : viem.ExactPartial<viem.ExtractFormattedTransactionRequest<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, {
        type?: ((request["type"] extends string ? request["type"] : viem.IsNever<viem.IsNever<Extract<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_21 ? T_21 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_21 extends object ? request extends viem.ExactPartial<T_21> ? T_21 extends {
            type?: infer type | undefined;
        } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>>> extends true ? Exclude<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_22 ? T_22 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_22 extends object ? request extends viem.ExactPartial<T_22> ? T_22 extends {
            type?: infer type | undefined;
        } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>> : never> extends false ? viem.IsNever<Extract<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_23 ? T_23 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_23 extends object ? request extends viem.ExactPartial<T_23> ? T_23 extends {
            type?: infer type | undefined;
        } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>>> extends true ? Exclude<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_24 ? T_24 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_24 extends object ? request extends viem.ExactPartial<T_24> ? T_24 extends {
            type?: infer type | undefined;
        } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>> : never : request["type"] extends string | undefined ? request["type"] : viem.GetTransactionType<request, (request extends {
            accessList?: undefined | undefined;
            authorizationList?: undefined | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: bigint | undefined;
            sidecars?: undefined | undefined;
        } & viem.FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: undefined | undefined;
        } & (viem.OneOf<{
            maxFeePerGas: viem.FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: viem.FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, viem.FeeValuesEIP1559> & {
            accessList?: viem.TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: bigint | undefined;
            sidecars?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: undefined | undefined;
            maxPriorityFeePerGas?: undefined | undefined;
        } & {
            accessList: viem.TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
            blobVersionedHashes?: readonly `0x${string}`[] | undefined;
            maxFeePerBlobGas?: bigint | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
        } | {
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
            blobVersionedHashes?: readonly `0x${string}`[] | undefined;
            maxFeePerBlobGas?: bigint | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
        }) & (viem.ExactPartial<viem.FeeValuesEIP4844> & viem.OneOf<{
            blobs: viem.TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: viem.TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: viem.TransactionSerializableEIP4844["sidecars"];
        }, viem.TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: viem.AccessList | undefined;
            authorizationList?: viem.SignedAuthorizationList | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: undefined | undefined;
        } | {
            accessList?: viem.AccessList | undefined;
            authorizationList?: viem.SignedAuthorizationList | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: undefined | undefined;
        }) & {
            authorizationList: viem.TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string | undefined ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : viem.GetTransactionType<request, (request extends {
            accessList?: undefined | undefined;
            authorizationList?: undefined | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: bigint | undefined;
            sidecars?: undefined | undefined;
        } & viem.FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: undefined | undefined;
        } & (viem.OneOf<{
            maxFeePerGas: viem.FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: viem.FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, viem.FeeValuesEIP1559> & {
            accessList?: viem.TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: bigint | undefined;
            sidecars?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: undefined | undefined;
            maxPriorityFeePerGas?: undefined | undefined;
        } & {
            accessList: viem.TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
            blobVersionedHashes?: readonly `0x${string}`[] | undefined;
            maxFeePerBlobGas?: bigint | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
        } | {
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
            blobVersionedHashes?: readonly `0x${string}`[] | undefined;
            maxFeePerBlobGas?: bigint | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
        }) & (viem.ExactPartial<viem.FeeValuesEIP4844> & viem.OneOf<{
            blobs: viem.TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: viem.TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: viem.TransactionSerializableEIP4844["sidecars"];
        }, viem.TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: viem.AccessList | undefined;
            authorizationList?: viem.SignedAuthorizationList | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: undefined | undefined;
        } | {
            accessList?: viem.AccessList | undefined;
            authorizationList?: viem.SignedAuthorizationList | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: undefined | undefined;
        }) & {
            authorizationList: viem.TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string | undefined ? Extract<request["type"], string> : never)>) extends infer T_25 ? T_25 extends (request["type"] extends string ? request["type"] : viem.IsNever<viem.IsNever<Extract<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_26 ? T_26 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_26 extends object ? request extends viem.ExactPartial<T_26> ? T_26 extends {
            type?: infer type | undefined;
        } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>>> extends true ? Exclude<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_27 ? T_27 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_27 extends object ? request extends viem.ExactPartial<T_27> ? T_27 extends {
            type?: infer type | undefined;
        } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>> : never> extends false ? viem.IsNever<Extract<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_28 ? T_28 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_28 extends object ? request extends viem.ExactPartial<T_28> ? T_28 extends {
            type?: infer type | undefined;
        } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>>> extends true ? Exclude<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_29 ? T_29 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_29 extends object ? request extends viem.ExactPartial<T_29> ? T_29 extends {
            type?: infer type | undefined;
        } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>> : never : request["type"] extends string | undefined ? request["type"] : viem.GetTransactionType<request, (request extends {
            accessList?: undefined | undefined;
            authorizationList?: undefined | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: bigint | undefined;
            sidecars?: undefined | undefined;
        } & viem.FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: undefined | undefined;
        } & (viem.OneOf<{
            maxFeePerGas: viem.FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: viem.FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, viem.FeeValuesEIP1559> & {
            accessList?: viem.TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: bigint | undefined;
            sidecars?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: undefined | undefined;
            maxPriorityFeePerGas?: undefined | undefined;
        } & {
            accessList: viem.TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
            blobVersionedHashes?: readonly `0x${string}`[] | undefined;
            maxFeePerBlobGas?: bigint | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
        } | {
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
            blobVersionedHashes?: readonly `0x${string}`[] | undefined;
            maxFeePerBlobGas?: bigint | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
        }) & (viem.ExactPartial<viem.FeeValuesEIP4844> & viem.OneOf<{
            blobs: viem.TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: viem.TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: viem.TransactionSerializableEIP4844["sidecars"];
        }, viem.TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: viem.AccessList | undefined;
            authorizationList?: viem.SignedAuthorizationList | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: undefined | undefined;
        } | {
            accessList?: viem.AccessList | undefined;
            authorizationList?: viem.SignedAuthorizationList | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: undefined | undefined;
        }) & {
            authorizationList: viem.TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string | undefined ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : viem.GetTransactionType<request, (request extends {
            accessList?: undefined | undefined;
            authorizationList?: undefined | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: bigint | undefined;
            sidecars?: undefined | undefined;
        } & viem.FeeValuesLegacy ? "legacy" : never) | (request extends {
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: undefined | undefined;
        } & (viem.OneOf<{
            maxFeePerGas: viem.FeeValuesEIP1559["maxFeePerGas"];
        } | {
            maxPriorityFeePerGas: viem.FeeValuesEIP1559["maxPriorityFeePerGas"];
        }, viem.FeeValuesEIP1559> & {
            accessList?: viem.TransactionSerializableEIP2930["accessList"] | undefined;
        }) ? "eip1559" : never) | (request extends {
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: bigint | undefined;
            sidecars?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: undefined | undefined;
            maxPriorityFeePerGas?: undefined | undefined;
        } & {
            accessList: viem.TransactionSerializableEIP2930["accessList"];
        } ? "eip2930" : never) | (request extends ({
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
            blobVersionedHashes?: readonly `0x${string}`[] | undefined;
            maxFeePerBlobGas?: bigint | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
        } | {
            accessList?: viem.AccessList | undefined;
            authorizationList?: undefined | undefined;
            blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
            blobVersionedHashes?: readonly `0x${string}`[] | undefined;
            maxFeePerBlobGas?: bigint | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
        }) & (viem.ExactPartial<viem.FeeValuesEIP4844> & viem.OneOf<{
            blobs: viem.TransactionSerializableEIP4844["blobs"];
        } | {
            blobVersionedHashes: viem.TransactionSerializableEIP4844["blobVersionedHashes"];
        } | {
            sidecars: viem.TransactionSerializableEIP4844["sidecars"];
        }, viem.TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
            accessList?: viem.AccessList | undefined;
            authorizationList?: viem.SignedAuthorizationList | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: undefined | undefined;
        } | {
            accessList?: viem.AccessList | undefined;
            authorizationList?: viem.SignedAuthorizationList | undefined;
            blobs?: undefined | undefined;
            blobVersionedHashes?: undefined | undefined;
            gasPrice?: undefined | undefined;
            maxFeePerBlobGas?: undefined | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            sidecars?: undefined | undefined;
        }) & {
            authorizationList: viem.TransactionSerializableEIP7702["authorizationList"];
        } ? "eip7702" : never) | (request["type"] extends string | undefined ? Extract<request["type"], string> : never)>) ? T_25 extends string ? T_25 : undefined : never : never) | undefined;
    }, viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from">, ((request["type"] extends string ? request["type"] : viem.IsNever<viem.IsNever<Extract<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_30 ? T_30 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_30 extends object ? request extends viem.ExactPartial<T_30> ? T_30 extends {
        type?: infer type | undefined;
    } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>>> extends true ? Exclude<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_31 ? T_31 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_31 extends object ? request extends viem.ExactPartial<T_31> ? T_31 extends {
        type?: infer type | undefined;
    } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>> : never> extends false ? viem.IsNever<Extract<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_32 ? T_32 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_32 extends object ? request extends viem.ExactPartial<T_32> ? T_32 extends {
        type?: infer type | undefined;
    } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>>> extends true ? Exclude<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_33 ? T_33 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_33 extends object ? request extends viem.ExactPartial<T_33> ? T_33 extends {
        type?: infer type | undefined;
    } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>> : never : request["type"] extends string | undefined ? request["type"] : viem.GetTransactionType<request, (request extends {
        accessList?: undefined | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: bigint | undefined;
        sidecars?: undefined | undefined;
    } & viem.FeeValuesLegacy ? "legacy" : never) | (request extends {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    } & (viem.OneOf<{
        maxFeePerGas: viem.FeeValuesEIP1559["maxFeePerGas"];
    } | {
        maxPriorityFeePerGas: viem.FeeValuesEIP1559["maxPriorityFeePerGas"];
    }, viem.FeeValuesEIP1559> & {
        accessList?: viem.TransactionSerializableEIP2930["accessList"] | undefined;
    }) ? "eip1559" : never) | (request extends {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: bigint | undefined;
        sidecars?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: undefined | undefined;
        maxPriorityFeePerGas?: undefined | undefined;
    } & {
        accessList: viem.TransactionSerializableEIP2930["accessList"];
    } ? "eip2930" : never) | (request extends ({
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
        blobVersionedHashes?: readonly `0x${string}`[] | undefined;
        maxFeePerBlobGas?: bigint | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
    } | {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
        blobVersionedHashes?: readonly `0x${string}`[] | undefined;
        maxFeePerBlobGas?: bigint | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
    }) & (viem.ExactPartial<viem.FeeValuesEIP4844> & viem.OneOf<{
        blobs: viem.TransactionSerializableEIP4844["blobs"];
    } | {
        blobVersionedHashes: viem.TransactionSerializableEIP4844["blobVersionedHashes"];
    } | {
        sidecars: viem.TransactionSerializableEIP4844["sidecars"];
    }, viem.TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
        accessList?: viem.AccessList | undefined;
        authorizationList?: viem.SignedAuthorizationList | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    } | {
        accessList?: viem.AccessList | undefined;
        authorizationList?: viem.SignedAuthorizationList | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    }) & {
        authorizationList: viem.TransactionSerializableEIP7702["authorizationList"];
    } ? "eip7702" : never) | (request["type"] extends string | undefined ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : viem.GetTransactionType<request, (request extends {
        accessList?: undefined | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: bigint | undefined;
        sidecars?: undefined | undefined;
    } & viem.FeeValuesLegacy ? "legacy" : never) | (request extends {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    } & (viem.OneOf<{
        maxFeePerGas: viem.FeeValuesEIP1559["maxFeePerGas"];
    } | {
        maxPriorityFeePerGas: viem.FeeValuesEIP1559["maxPriorityFeePerGas"];
    }, viem.FeeValuesEIP1559> & {
        accessList?: viem.TransactionSerializableEIP2930["accessList"] | undefined;
    }) ? "eip1559" : never) | (request extends {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: bigint | undefined;
        sidecars?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: undefined | undefined;
        maxPriorityFeePerGas?: undefined | undefined;
    } & {
        accessList: viem.TransactionSerializableEIP2930["accessList"];
    } ? "eip2930" : never) | (request extends ({
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
        blobVersionedHashes?: readonly `0x${string}`[] | undefined;
        maxFeePerBlobGas?: bigint | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
    } | {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
        blobVersionedHashes?: readonly `0x${string}`[] | undefined;
        maxFeePerBlobGas?: bigint | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
    }) & (viem.ExactPartial<viem.FeeValuesEIP4844> & viem.OneOf<{
        blobs: viem.TransactionSerializableEIP4844["blobs"];
    } | {
        blobVersionedHashes: viem.TransactionSerializableEIP4844["blobVersionedHashes"];
    } | {
        sidecars: viem.TransactionSerializableEIP4844["sidecars"];
    }, viem.TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
        accessList?: viem.AccessList | undefined;
        authorizationList?: viem.SignedAuthorizationList | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    } | {
        accessList?: viem.AccessList | undefined;
        authorizationList?: viem.SignedAuthorizationList | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    }) & {
        authorizationList: viem.TransactionSerializableEIP7702["authorizationList"];
    } ? "eip7702" : never) | (request["type"] extends string | undefined ? Extract<request["type"], string> : never)>) extends infer T_34 ? T_34 extends (request["type"] extends string ? request["type"] : viem.IsNever<viem.IsNever<Extract<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_35 ? T_35 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_35 extends object ? request extends viem.ExactPartial<T_35> ? T_35 extends {
        type?: infer type | undefined;
    } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>>> extends true ? Exclude<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_36 ? T_36 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_36 extends object ? request extends viem.ExactPartial<T_36> ? T_36 extends {
        type?: infer type | undefined;
    } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>> : never> extends false ? viem.IsNever<Extract<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_37 ? T_37 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_37 extends object ? request extends viem.ExactPartial<T_37> ? T_37 extends {
        type?: infer type | undefined;
    } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>>> extends true ? Exclude<viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> extends infer T_38 ? T_38 extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> ? T_38 extends object ? request extends viem.ExactPartial<T_38> ? T_38 extends {
        type?: infer type | undefined;
    } ? Extract<type, string> : never : never : never : never : never, NonNullable<"legacy" | "eip2930" | "eip1559" | "eip4844" | "eip7702" | undefined>> : never : request["type"] extends string | undefined ? request["type"] : viem.GetTransactionType<request, (request extends {
        accessList?: undefined | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: bigint | undefined;
        sidecars?: undefined | undefined;
    } & viem.FeeValuesLegacy ? "legacy" : never) | (request extends {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    } & (viem.OneOf<{
        maxFeePerGas: viem.FeeValuesEIP1559["maxFeePerGas"];
    } | {
        maxPriorityFeePerGas: viem.FeeValuesEIP1559["maxPriorityFeePerGas"];
    }, viem.FeeValuesEIP1559> & {
        accessList?: viem.TransactionSerializableEIP2930["accessList"] | undefined;
    }) ? "eip1559" : never) | (request extends {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: bigint | undefined;
        sidecars?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: undefined | undefined;
        maxPriorityFeePerGas?: undefined | undefined;
    } & {
        accessList: viem.TransactionSerializableEIP2930["accessList"];
    } ? "eip2930" : never) | (request extends ({
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
        blobVersionedHashes?: readonly `0x${string}`[] | undefined;
        maxFeePerBlobGas?: bigint | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
    } | {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
        blobVersionedHashes?: readonly `0x${string}`[] | undefined;
        maxFeePerBlobGas?: bigint | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
    }) & (viem.ExactPartial<viem.FeeValuesEIP4844> & viem.OneOf<{
        blobs: viem.TransactionSerializableEIP4844["blobs"];
    } | {
        blobVersionedHashes: viem.TransactionSerializableEIP4844["blobVersionedHashes"];
    } | {
        sidecars: viem.TransactionSerializableEIP4844["sidecars"];
    }, viem.TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
        accessList?: viem.AccessList | undefined;
        authorizationList?: viem.SignedAuthorizationList | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    } | {
        accessList?: viem.AccessList | undefined;
        authorizationList?: viem.SignedAuthorizationList | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    }) & {
        authorizationList: viem.TransactionSerializableEIP7702["authorizationList"];
    } ? "eip7702" : never) | (request["type"] extends string | undefined ? Extract<request["type"], string> : never)> extends "legacy" ? unknown : viem.GetTransactionType<request, (request extends {
        accessList?: undefined | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: bigint | undefined;
        sidecars?: undefined | undefined;
    } & viem.FeeValuesLegacy ? "legacy" : never) | (request extends {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    } & (viem.OneOf<{
        maxFeePerGas: viem.FeeValuesEIP1559["maxFeePerGas"];
    } | {
        maxPriorityFeePerGas: viem.FeeValuesEIP1559["maxPriorityFeePerGas"];
    }, viem.FeeValuesEIP1559> & {
        accessList?: viem.TransactionSerializableEIP2930["accessList"] | undefined;
    }) ? "eip1559" : never) | (request extends {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: bigint | undefined;
        sidecars?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: undefined | undefined;
        maxPriorityFeePerGas?: undefined | undefined;
    } & {
        accessList: viem.TransactionSerializableEIP2930["accessList"];
    } ? "eip2930" : never) | (request extends ({
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
        blobVersionedHashes?: readonly `0x${string}`[] | undefined;
        maxFeePerBlobGas?: bigint | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
    } | {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
        blobVersionedHashes?: readonly `0x${string}`[] | undefined;
        maxFeePerBlobGas?: bigint | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
    }) & (viem.ExactPartial<viem.FeeValuesEIP4844> & viem.OneOf<{
        blobs: viem.TransactionSerializableEIP4844["blobs"];
    } | {
        blobVersionedHashes: viem.TransactionSerializableEIP4844["blobVersionedHashes"];
    } | {
        sidecars: viem.TransactionSerializableEIP4844["sidecars"];
    }, viem.TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
        accessList?: viem.AccessList | undefined;
        authorizationList?: viem.SignedAuthorizationList | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    } | {
        accessList?: viem.AccessList | undefined;
        authorizationList?: viem.SignedAuthorizationList | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    }) & {
        authorizationList: viem.TransactionSerializableEIP7702["authorizationList"];
    } ? "eip7702" : never) | (request["type"] extends string | undefined ? Extract<request["type"], string> : never)>) ? T_34 extends string ? T_34 : undefined : never : never) | undefined>>> & {
        chainId?: number | undefined;
    }, (request["parameters"] extends readonly viem.PrepareTransactionRequestParameterType[] ? request["parameters"][number] : "chainId" | "fees" | "gas" | "nonce" | "blobVersionedHashes" | "type") extends infer T_39 ? T_39 extends (request["parameters"] extends readonly viem.PrepareTransactionRequestParameterType[] ? request["parameters"][number] : "chainId" | "fees" | "gas" | "nonce" | "blobVersionedHashes" | "type") ? T_39 extends "fees" ? "gasPrice" | "maxFeePerGas" | "maxPriorityFeePerGas" : T_39 : never : never> & (unknown extends request["kzg"] ? {} : Pick<request, "kzg">) & {
        _capabilities?: {
            [x: string]: any;
        } | undefined;
    } extends infer T ? { [K in keyof T]: T[K]; } : never>;
    requestAddresses: () => Promise<viem.RequestAddressesReturnType>;
    requestPermissions: (args: viem.RequestPermissionsParameters) => Promise<viem.RequestPermissionsReturnType>;
    sendCalls: <const calls extends readonly unknown[], chainOverride extends viem.Chain | undefined = undefined>(parameters: viem.SendCallsParameters<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, undefined, chainOverride, calls>) => Promise<{
        capabilities?: {
            [x: string]: any;
        } | undefined;
        id: string;
    }>;
    sendCallsSync: <const calls extends readonly unknown[], chainOverride extends viem.Chain | undefined = undefined>(parameters: viem.SendCallsSyncParameters<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, undefined, chainOverride, calls>) => Promise<{
        chainId: number;
        id: string;
        atomic: boolean;
        capabilities?: {
            [key: string]: any;
        } | {
            [x: string]: any;
        } | undefined;
        receipts?: viem.WalletCallReceipt<bigint, "success" | "reverted">[] | undefined;
        version: string;
        statusCode: number;
        status: "pending" | "success" | "failure" | undefined;
    }>;
    sendRawTransaction: (args: viem.SendRawTransactionParameters) => Promise<viem.SendRawTransactionReturnType>;
    sendRawTransactionSync: (args: viem.SendRawTransactionSyncParameters) => Promise<viem.TransactionReceipt>;
    sendTransaction: <const request extends viem.SendTransactionRequest<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, chainOverride extends viem.Chain | undefined = undefined>(args: viem.SendTransactionParameters<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, undefined, chainOverride, request>) => Promise<viem.SendTransactionReturnType>;
    sendTransactionSync: <const request extends viem.SendTransactionSyncRequest<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, chainOverride extends viem.Chain | undefined = undefined>(args: viem.SendTransactionSyncParameters<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, undefined, chainOverride, request>) => Promise<viem.TransactionReceipt>;
    showCallsStatus: (parameters: viem.ShowCallsStatusParameters) => Promise<viem.ShowCallsStatusReturnType>;
    signAuthorization: (parameters: viem.SignAuthorizationParameters<undefined>) => Promise<viem.SignAuthorizationReturnType>;
    signMessage: (args: viem.SignMessageParameters<undefined>) => Promise<viem.SignMessageReturnType>;
    signTransaction: <chainOverride extends viem.Chain | undefined, const request extends viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from"> = viem.UnionOmit<viem.ExtractChainFormatterParameters<viem.DeriveChain<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, chainOverride>, "transactionRequest", viem.TransactionRequest>, "from">>(args: viem.SignTransactionParameters<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, undefined, chainOverride, request>) => Promise<viem.TransactionSerialized<viem.GetTransactionType<request, (request extends {
        accessList?: undefined | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: bigint | undefined;
        sidecars?: undefined | undefined;
    } & viem.FeeValuesLegacy ? "legacy" : never) | (request extends {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    } & (viem.OneOf<{
        maxFeePerGas: viem.FeeValuesEIP1559["maxFeePerGas"];
    } | {
        maxPriorityFeePerGas: viem.FeeValuesEIP1559["maxPriorityFeePerGas"];
    }, viem.FeeValuesEIP1559> & {
        accessList?: viem.TransactionSerializableEIP2930["accessList"] | undefined;
    }) ? "eip1559" : never) | (request extends {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: bigint | undefined;
        sidecars?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: undefined | undefined;
        maxPriorityFeePerGas?: undefined | undefined;
    } & {
        accessList: viem.TransactionSerializableEIP2930["accessList"];
    } ? "eip2930" : never) | (request extends ({
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
        blobVersionedHashes?: readonly `0x${string}`[] | undefined;
        maxFeePerBlobGas?: bigint | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
    } | {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
        blobVersionedHashes?: readonly `0x${string}`[] | undefined;
        maxFeePerBlobGas?: bigint | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
    }) & (viem.ExactPartial<viem.FeeValuesEIP4844> & viem.OneOf<{
        blobs: viem.TransactionSerializableEIP4844["blobs"];
    } | {
        blobVersionedHashes: viem.TransactionSerializableEIP4844["blobVersionedHashes"];
    } | {
        sidecars: viem.TransactionSerializableEIP4844["sidecars"];
    }, viem.TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
        accessList?: viem.AccessList | undefined;
        authorizationList?: viem.SignedAuthorizationList | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    } | {
        accessList?: viem.AccessList | undefined;
        authorizationList?: viem.SignedAuthorizationList | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    }) & {
        authorizationList: viem.TransactionSerializableEIP7702["authorizationList"];
    } ? "eip7702" : never) | (request["type"] extends string | undefined ? Extract<request["type"], string> : never)>, (viem.GetTransactionType<request, (request extends {
        accessList?: undefined | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: bigint | undefined;
        sidecars?: undefined | undefined;
    } & viem.FeeValuesLegacy ? "legacy" : never) | (request extends {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    } & (viem.OneOf<{
        maxFeePerGas: viem.FeeValuesEIP1559["maxFeePerGas"];
    } | {
        maxPriorityFeePerGas: viem.FeeValuesEIP1559["maxPriorityFeePerGas"];
    }, viem.FeeValuesEIP1559> & {
        accessList?: viem.TransactionSerializableEIP2930["accessList"] | undefined;
    }) ? "eip1559" : never) | (request extends {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: bigint | undefined;
        sidecars?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: undefined | undefined;
        maxPriorityFeePerGas?: undefined | undefined;
    } & {
        accessList: viem.TransactionSerializableEIP2930["accessList"];
    } ? "eip2930" : never) | (request extends ({
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
        blobVersionedHashes?: readonly `0x${string}`[] | undefined;
        maxFeePerBlobGas?: bigint | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
    } | {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
        blobVersionedHashes?: readonly `0x${string}`[] | undefined;
        maxFeePerBlobGas?: bigint | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
    }) & (viem.ExactPartial<viem.FeeValuesEIP4844> & viem.OneOf<{
        blobs: viem.TransactionSerializableEIP4844["blobs"];
    } | {
        blobVersionedHashes: viem.TransactionSerializableEIP4844["blobVersionedHashes"];
    } | {
        sidecars: viem.TransactionSerializableEIP4844["sidecars"];
    }, viem.TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
        accessList?: viem.AccessList | undefined;
        authorizationList?: viem.SignedAuthorizationList | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    } | {
        accessList?: viem.AccessList | undefined;
        authorizationList?: viem.SignedAuthorizationList | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    }) & {
        authorizationList: viem.TransactionSerializableEIP7702["authorizationList"];
    } ? "eip7702" : never) | (request["type"] extends string | undefined ? Extract<request["type"], string> : never)> extends infer T ? T extends viem.GetTransactionType<request, (request extends {
        accessList?: undefined | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: bigint | undefined;
        sidecars?: undefined | undefined;
    } & viem.FeeValuesLegacy ? "legacy" : never) | (request extends {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    } & (viem.OneOf<{
        maxFeePerGas: viem.FeeValuesEIP1559["maxFeePerGas"];
    } | {
        maxPriorityFeePerGas: viem.FeeValuesEIP1559["maxPriorityFeePerGas"];
    }, viem.FeeValuesEIP1559> & {
        accessList?: viem.TransactionSerializableEIP2930["accessList"] | undefined;
    }) ? "eip1559" : never) | (request extends {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: bigint | undefined;
        sidecars?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: undefined | undefined;
        maxPriorityFeePerGas?: undefined | undefined;
    } & {
        accessList: viem.TransactionSerializableEIP2930["accessList"];
    } ? "eip2930" : never) | (request extends ({
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
        blobVersionedHashes?: readonly `0x${string}`[] | undefined;
        maxFeePerBlobGas?: bigint | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
    } | {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
        blobVersionedHashes?: readonly `0x${string}`[] | undefined;
        maxFeePerBlobGas?: bigint | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
    }) & (viem.ExactPartial<viem.FeeValuesEIP4844> & viem.OneOf<{
        blobs: viem.TransactionSerializableEIP4844["blobs"];
    } | {
        blobVersionedHashes: viem.TransactionSerializableEIP4844["blobVersionedHashes"];
    } | {
        sidecars: viem.TransactionSerializableEIP4844["sidecars"];
    }, viem.TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
        accessList?: viem.AccessList | undefined;
        authorizationList?: viem.SignedAuthorizationList | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    } | {
        accessList?: viem.AccessList | undefined;
        authorizationList?: viem.SignedAuthorizationList | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    }) & {
        authorizationList: viem.TransactionSerializableEIP7702["authorizationList"];
    } ? "eip7702" : never) | (request["type"] extends string | undefined ? Extract<request["type"], string> : never)> ? T extends "eip1559" ? `0x02${string}` : never : never : never) | (viem.GetTransactionType<request, (request extends {
        accessList?: undefined | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: bigint | undefined;
        sidecars?: undefined | undefined;
    } & viem.FeeValuesLegacy ? "legacy" : never) | (request extends {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    } & (viem.OneOf<{
        maxFeePerGas: viem.FeeValuesEIP1559["maxFeePerGas"];
    } | {
        maxPriorityFeePerGas: viem.FeeValuesEIP1559["maxPriorityFeePerGas"];
    }, viem.FeeValuesEIP1559> & {
        accessList?: viem.TransactionSerializableEIP2930["accessList"] | undefined;
    }) ? "eip1559" : never) | (request extends {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: bigint | undefined;
        sidecars?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: undefined | undefined;
        maxPriorityFeePerGas?: undefined | undefined;
    } & {
        accessList: viem.TransactionSerializableEIP2930["accessList"];
    } ? "eip2930" : never) | (request extends ({
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
        blobVersionedHashes?: readonly `0x${string}`[] | undefined;
        maxFeePerBlobGas?: bigint | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
    } | {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
        blobVersionedHashes?: readonly `0x${string}`[] | undefined;
        maxFeePerBlobGas?: bigint | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
    }) & (viem.ExactPartial<viem.FeeValuesEIP4844> & viem.OneOf<{
        blobs: viem.TransactionSerializableEIP4844["blobs"];
    } | {
        blobVersionedHashes: viem.TransactionSerializableEIP4844["blobVersionedHashes"];
    } | {
        sidecars: viem.TransactionSerializableEIP4844["sidecars"];
    }, viem.TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
        accessList?: viem.AccessList | undefined;
        authorizationList?: viem.SignedAuthorizationList | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    } | {
        accessList?: viem.AccessList | undefined;
        authorizationList?: viem.SignedAuthorizationList | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    }) & {
        authorizationList: viem.TransactionSerializableEIP7702["authorizationList"];
    } ? "eip7702" : never) | (request["type"] extends string | undefined ? Extract<request["type"], string> : never)> extends infer T_1 ? T_1 extends viem.GetTransactionType<request, (request extends {
        accessList?: undefined | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: bigint | undefined;
        sidecars?: undefined | undefined;
    } & viem.FeeValuesLegacy ? "legacy" : never) | (request extends {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    } & (viem.OneOf<{
        maxFeePerGas: viem.FeeValuesEIP1559["maxFeePerGas"];
    } | {
        maxPriorityFeePerGas: viem.FeeValuesEIP1559["maxPriorityFeePerGas"];
    }, viem.FeeValuesEIP1559> & {
        accessList?: viem.TransactionSerializableEIP2930["accessList"] | undefined;
    }) ? "eip1559" : never) | (request extends {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: bigint | undefined;
        sidecars?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: undefined | undefined;
        maxPriorityFeePerGas?: undefined | undefined;
    } & {
        accessList: viem.TransactionSerializableEIP2930["accessList"];
    } ? "eip2930" : never) | (request extends ({
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
        blobVersionedHashes?: readonly `0x${string}`[] | undefined;
        maxFeePerBlobGas?: bigint | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
    } | {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
        blobVersionedHashes?: readonly `0x${string}`[] | undefined;
        maxFeePerBlobGas?: bigint | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
    }) & (viem.ExactPartial<viem.FeeValuesEIP4844> & viem.OneOf<{
        blobs: viem.TransactionSerializableEIP4844["blobs"];
    } | {
        blobVersionedHashes: viem.TransactionSerializableEIP4844["blobVersionedHashes"];
    } | {
        sidecars: viem.TransactionSerializableEIP4844["sidecars"];
    }, viem.TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
        accessList?: viem.AccessList | undefined;
        authorizationList?: viem.SignedAuthorizationList | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    } | {
        accessList?: viem.AccessList | undefined;
        authorizationList?: viem.SignedAuthorizationList | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    }) & {
        authorizationList: viem.TransactionSerializableEIP7702["authorizationList"];
    } ? "eip7702" : never) | (request["type"] extends string | undefined ? Extract<request["type"], string> : never)> ? T_1 extends "eip2930" ? `0x01${string}` : never : never : never) | (viem.GetTransactionType<request, (request extends {
        accessList?: undefined | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: bigint | undefined;
        sidecars?: undefined | undefined;
    } & viem.FeeValuesLegacy ? "legacy" : never) | (request extends {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    } & (viem.OneOf<{
        maxFeePerGas: viem.FeeValuesEIP1559["maxFeePerGas"];
    } | {
        maxPriorityFeePerGas: viem.FeeValuesEIP1559["maxPriorityFeePerGas"];
    }, viem.FeeValuesEIP1559> & {
        accessList?: viem.TransactionSerializableEIP2930["accessList"] | undefined;
    }) ? "eip1559" : never) | (request extends {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: bigint | undefined;
        sidecars?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: undefined | undefined;
        maxPriorityFeePerGas?: undefined | undefined;
    } & {
        accessList: viem.TransactionSerializableEIP2930["accessList"];
    } ? "eip2930" : never) | (request extends ({
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
        blobVersionedHashes?: readonly `0x${string}`[] | undefined;
        maxFeePerBlobGas?: bigint | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
    } | {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
        blobVersionedHashes?: readonly `0x${string}`[] | undefined;
        maxFeePerBlobGas?: bigint | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
    }) & (viem.ExactPartial<viem.FeeValuesEIP4844> & viem.OneOf<{
        blobs: viem.TransactionSerializableEIP4844["blobs"];
    } | {
        blobVersionedHashes: viem.TransactionSerializableEIP4844["blobVersionedHashes"];
    } | {
        sidecars: viem.TransactionSerializableEIP4844["sidecars"];
    }, viem.TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
        accessList?: viem.AccessList | undefined;
        authorizationList?: viem.SignedAuthorizationList | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    } | {
        accessList?: viem.AccessList | undefined;
        authorizationList?: viem.SignedAuthorizationList | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    }) & {
        authorizationList: viem.TransactionSerializableEIP7702["authorizationList"];
    } ? "eip7702" : never) | (request["type"] extends string | undefined ? Extract<request["type"], string> : never)> extends infer T_2 ? T_2 extends viem.GetTransactionType<request, (request extends {
        accessList?: undefined | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: bigint | undefined;
        sidecars?: undefined | undefined;
    } & viem.FeeValuesLegacy ? "legacy" : never) | (request extends {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    } & (viem.OneOf<{
        maxFeePerGas: viem.FeeValuesEIP1559["maxFeePerGas"];
    } | {
        maxPriorityFeePerGas: viem.FeeValuesEIP1559["maxPriorityFeePerGas"];
    }, viem.FeeValuesEIP1559> & {
        accessList?: viem.TransactionSerializableEIP2930["accessList"] | undefined;
    }) ? "eip1559" : never) | (request extends {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: bigint | undefined;
        sidecars?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: undefined | undefined;
        maxPriorityFeePerGas?: undefined | undefined;
    } & {
        accessList: viem.TransactionSerializableEIP2930["accessList"];
    } ? "eip2930" : never) | (request extends ({
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
        blobVersionedHashes?: readonly `0x${string}`[] | undefined;
        maxFeePerBlobGas?: bigint | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
    } | {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
        blobVersionedHashes?: readonly `0x${string}`[] | undefined;
        maxFeePerBlobGas?: bigint | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
    }) & (viem.ExactPartial<viem.FeeValuesEIP4844> & viem.OneOf<{
        blobs: viem.TransactionSerializableEIP4844["blobs"];
    } | {
        blobVersionedHashes: viem.TransactionSerializableEIP4844["blobVersionedHashes"];
    } | {
        sidecars: viem.TransactionSerializableEIP4844["sidecars"];
    }, viem.TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
        accessList?: viem.AccessList | undefined;
        authorizationList?: viem.SignedAuthorizationList | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    } | {
        accessList?: viem.AccessList | undefined;
        authorizationList?: viem.SignedAuthorizationList | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    }) & {
        authorizationList: viem.TransactionSerializableEIP7702["authorizationList"];
    } ? "eip7702" : never) | (request["type"] extends string | undefined ? Extract<request["type"], string> : never)> ? T_2 extends "eip4844" ? `0x03${string}` : never : never : never) | (viem.GetTransactionType<request, (request extends {
        accessList?: undefined | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: bigint | undefined;
        sidecars?: undefined | undefined;
    } & viem.FeeValuesLegacy ? "legacy" : never) | (request extends {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    } & (viem.OneOf<{
        maxFeePerGas: viem.FeeValuesEIP1559["maxFeePerGas"];
    } | {
        maxPriorityFeePerGas: viem.FeeValuesEIP1559["maxPriorityFeePerGas"];
    }, viem.FeeValuesEIP1559> & {
        accessList?: viem.TransactionSerializableEIP2930["accessList"] | undefined;
    }) ? "eip1559" : never) | (request extends {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: bigint | undefined;
        sidecars?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: undefined | undefined;
        maxPriorityFeePerGas?: undefined | undefined;
    } & {
        accessList: viem.TransactionSerializableEIP2930["accessList"];
    } ? "eip2930" : never) | (request extends ({
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
        blobVersionedHashes?: readonly `0x${string}`[] | undefined;
        maxFeePerBlobGas?: bigint | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
    } | {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
        blobVersionedHashes?: readonly `0x${string}`[] | undefined;
        maxFeePerBlobGas?: bigint | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
    }) & (viem.ExactPartial<viem.FeeValuesEIP4844> & viem.OneOf<{
        blobs: viem.TransactionSerializableEIP4844["blobs"];
    } | {
        blobVersionedHashes: viem.TransactionSerializableEIP4844["blobVersionedHashes"];
    } | {
        sidecars: viem.TransactionSerializableEIP4844["sidecars"];
    }, viem.TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
        accessList?: viem.AccessList | undefined;
        authorizationList?: viem.SignedAuthorizationList | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    } | {
        accessList?: viem.AccessList | undefined;
        authorizationList?: viem.SignedAuthorizationList | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    }) & {
        authorizationList: viem.TransactionSerializableEIP7702["authorizationList"];
    } ? "eip7702" : never) | (request["type"] extends string | undefined ? Extract<request["type"], string> : never)> extends infer T_3 ? T_3 extends viem.GetTransactionType<request, (request extends {
        accessList?: undefined | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: bigint | undefined;
        sidecars?: undefined | undefined;
    } & viem.FeeValuesLegacy ? "legacy" : never) | (request extends {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    } & (viem.OneOf<{
        maxFeePerGas: viem.FeeValuesEIP1559["maxFeePerGas"];
    } | {
        maxPriorityFeePerGas: viem.FeeValuesEIP1559["maxPriorityFeePerGas"];
    }, viem.FeeValuesEIP1559> & {
        accessList?: viem.TransactionSerializableEIP2930["accessList"] | undefined;
    }) ? "eip1559" : never) | (request extends {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: bigint | undefined;
        sidecars?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: undefined | undefined;
        maxPriorityFeePerGas?: undefined | undefined;
    } & {
        accessList: viem.TransactionSerializableEIP2930["accessList"];
    } ? "eip2930" : never) | (request extends ({
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
        blobVersionedHashes?: readonly `0x${string}`[] | undefined;
        maxFeePerBlobGas?: bigint | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
    } | {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
        blobVersionedHashes?: readonly `0x${string}`[] | undefined;
        maxFeePerBlobGas?: bigint | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
    }) & (viem.ExactPartial<viem.FeeValuesEIP4844> & viem.OneOf<{
        blobs: viem.TransactionSerializableEIP4844["blobs"];
    } | {
        blobVersionedHashes: viem.TransactionSerializableEIP4844["blobVersionedHashes"];
    } | {
        sidecars: viem.TransactionSerializableEIP4844["sidecars"];
    }, viem.TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
        accessList?: viem.AccessList | undefined;
        authorizationList?: viem.SignedAuthorizationList | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    } | {
        accessList?: viem.AccessList | undefined;
        authorizationList?: viem.SignedAuthorizationList | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    }) & {
        authorizationList: viem.TransactionSerializableEIP7702["authorizationList"];
    } ? "eip7702" : never) | (request["type"] extends string | undefined ? Extract<request["type"], string> : never)> ? T_3 extends "eip7702" ? `0x04${string}` : never : never : never) | (viem.GetTransactionType<request, (request extends {
        accessList?: undefined | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: bigint | undefined;
        sidecars?: undefined | undefined;
    } & viem.FeeValuesLegacy ? "legacy" : never) | (request extends {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    } & (viem.OneOf<{
        maxFeePerGas: viem.FeeValuesEIP1559["maxFeePerGas"];
    } | {
        maxPriorityFeePerGas: viem.FeeValuesEIP1559["maxPriorityFeePerGas"];
    }, viem.FeeValuesEIP1559> & {
        accessList?: viem.TransactionSerializableEIP2930["accessList"] | undefined;
    }) ? "eip1559" : never) | (request extends {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: bigint | undefined;
        sidecars?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: undefined | undefined;
        maxPriorityFeePerGas?: undefined | undefined;
    } & {
        accessList: viem.TransactionSerializableEIP2930["accessList"];
    } ? "eip2930" : never) | (request extends ({
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
        blobVersionedHashes?: readonly `0x${string}`[] | undefined;
        maxFeePerBlobGas?: bigint | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
    } | {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
        blobVersionedHashes?: readonly `0x${string}`[] | undefined;
        maxFeePerBlobGas?: bigint | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
    }) & (viem.ExactPartial<viem.FeeValuesEIP4844> & viem.OneOf<{
        blobs: viem.TransactionSerializableEIP4844["blobs"];
    } | {
        blobVersionedHashes: viem.TransactionSerializableEIP4844["blobVersionedHashes"];
    } | {
        sidecars: viem.TransactionSerializableEIP4844["sidecars"];
    }, viem.TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
        accessList?: viem.AccessList | undefined;
        authorizationList?: viem.SignedAuthorizationList | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    } | {
        accessList?: viem.AccessList | undefined;
        authorizationList?: viem.SignedAuthorizationList | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    }) & {
        authorizationList: viem.TransactionSerializableEIP7702["authorizationList"];
    } ? "eip7702" : never) | (request["type"] extends string | undefined ? Extract<request["type"], string> : never)> extends infer T_4 ? T_4 extends viem.GetTransactionType<request, (request extends {
        accessList?: undefined | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: bigint | undefined;
        sidecars?: undefined | undefined;
    } & viem.FeeValuesLegacy ? "legacy" : never) | (request extends {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    } & (viem.OneOf<{
        maxFeePerGas: viem.FeeValuesEIP1559["maxFeePerGas"];
    } | {
        maxPriorityFeePerGas: viem.FeeValuesEIP1559["maxPriorityFeePerGas"];
    }, viem.FeeValuesEIP1559> & {
        accessList?: viem.TransactionSerializableEIP2930["accessList"] | undefined;
    }) ? "eip1559" : never) | (request extends {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: bigint | undefined;
        sidecars?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: undefined | undefined;
        maxPriorityFeePerGas?: undefined | undefined;
    } & {
        accessList: viem.TransactionSerializableEIP2930["accessList"];
    } ? "eip2930" : never) | (request extends ({
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
        blobVersionedHashes?: readonly `0x${string}`[] | undefined;
        maxFeePerBlobGas?: bigint | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
    } | {
        accessList?: viem.AccessList | undefined;
        authorizationList?: undefined | undefined;
        blobs?: readonly `0x${string}`[] | readonly viem.ByteArray[] | undefined;
        blobVersionedHashes?: readonly `0x${string}`[] | undefined;
        maxFeePerBlobGas?: bigint | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: false | readonly viem.BlobSidecar<`0x${string}`>[] | undefined;
    }) & (viem.ExactPartial<viem.FeeValuesEIP4844> & viem.OneOf<{
        blobs: viem.TransactionSerializableEIP4844["blobs"];
    } | {
        blobVersionedHashes: viem.TransactionSerializableEIP4844["blobVersionedHashes"];
    } | {
        sidecars: viem.TransactionSerializableEIP4844["sidecars"];
    }, viem.TransactionSerializableEIP4844>) ? "eip4844" : never) | (request extends ({
        accessList?: viem.AccessList | undefined;
        authorizationList?: viem.SignedAuthorizationList | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    } | {
        accessList?: viem.AccessList | undefined;
        authorizationList?: viem.SignedAuthorizationList | undefined;
        blobs?: undefined | undefined;
        blobVersionedHashes?: undefined | undefined;
        gasPrice?: undefined | undefined;
        maxFeePerBlobGas?: undefined | undefined;
        maxFeePerGas?: bigint | undefined;
        maxPriorityFeePerGas?: bigint | undefined;
        sidecars?: undefined | undefined;
    }) & {
        authorizationList: viem.TransactionSerializableEIP7702["authorizationList"];
    } ? "eip7702" : never) | (request["type"] extends string | undefined ? Extract<request["type"], string> : never)> ? T_4 extends "legacy" ? viem.TransactionSerializedLegacy : never : never : never)>>;
    signTypedData: <const typedData extends {
        [x: string]: readonly viem.TypedDataParameter[];
        [x: `string[${string}]`]: undefined;
        [x: `function[${string}]`]: undefined;
        [x: `address[${string}]`]: undefined;
        [x: `bool[${string}]`]: undefined;
        [x: `bytes[${string}]`]: undefined;
        [x: `bytes1[${string}]`]: undefined;
        [x: `bytes2[${string}]`]: undefined;
        [x: `bytes18[${string}]`]: undefined;
        [x: `bytes3[${string}]`]: undefined;
        [x: `bytes4[${string}]`]: undefined;
        [x: `bytes5[${string}]`]: undefined;
        [x: `bytes6[${string}]`]: undefined;
        [x: `bytes7[${string}]`]: undefined;
        [x: `bytes8[${string}]`]: undefined;
        [x: `bytes9[${string}]`]: undefined;
        [x: `bytes10[${string}]`]: undefined;
        [x: `bytes11[${string}]`]: undefined;
        [x: `bytes12[${string}]`]: undefined;
        [x: `bytes13[${string}]`]: undefined;
        [x: `bytes14[${string}]`]: undefined;
        [x: `bytes15[${string}]`]: undefined;
        [x: `bytes16[${string}]`]: undefined;
        [x: `bytes17[${string}]`]: undefined;
        [x: `bytes19[${string}]`]: undefined;
        [x: `bytes20[${string}]`]: undefined;
        [x: `bytes21[${string}]`]: undefined;
        [x: `bytes22[${string}]`]: undefined;
        [x: `bytes23[${string}]`]: undefined;
        [x: `bytes24[${string}]`]: undefined;
        [x: `bytes25[${string}]`]: undefined;
        [x: `bytes26[${string}]`]: undefined;
        [x: `bytes27[${string}]`]: undefined;
        [x: `bytes28[${string}]`]: undefined;
        [x: `bytes29[${string}]`]: undefined;
        [x: `bytes30[${string}]`]: undefined;
        [x: `bytes31[${string}]`]: undefined;
        [x: `bytes32[${string}]`]: undefined;
        [x: `int[${string}]`]: undefined;
        [x: `int8[${string}]`]: undefined;
        [x: `int16[${string}]`]: undefined;
        [x: `int24[${string}]`]: undefined;
        [x: `int32[${string}]`]: undefined;
        [x: `int40[${string}]`]: undefined;
        [x: `int48[${string}]`]: undefined;
        [x: `int56[${string}]`]: undefined;
        [x: `int64[${string}]`]: undefined;
        [x: `int72[${string}]`]: undefined;
        [x: `int80[${string}]`]: undefined;
        [x: `int88[${string}]`]: undefined;
        [x: `int96[${string}]`]: undefined;
        [x: `int104[${string}]`]: undefined;
        [x: `int112[${string}]`]: undefined;
        [x: `int120[${string}]`]: undefined;
        [x: `int128[${string}]`]: undefined;
        [x: `int136[${string}]`]: undefined;
        [x: `int144[${string}]`]: undefined;
        [x: `int152[${string}]`]: undefined;
        [x: `int160[${string}]`]: undefined;
        [x: `int168[${string}]`]: undefined;
        [x: `int176[${string}]`]: undefined;
        [x: `int184[${string}]`]: undefined;
        [x: `int192[${string}]`]: undefined;
        [x: `int200[${string}]`]: undefined;
        [x: `int208[${string}]`]: undefined;
        [x: `int216[${string}]`]: undefined;
        [x: `int224[${string}]`]: undefined;
        [x: `int232[${string}]`]: undefined;
        [x: `int240[${string}]`]: undefined;
        [x: `int248[${string}]`]: undefined;
        [x: `int256[${string}]`]: undefined;
        [x: `uint[${string}]`]: undefined;
        [x: `uint8[${string}]`]: undefined;
        [x: `uint16[${string}]`]: undefined;
        [x: `uint24[${string}]`]: undefined;
        [x: `uint32[${string}]`]: undefined;
        [x: `uint40[${string}]`]: undefined;
        [x: `uint48[${string}]`]: undefined;
        [x: `uint56[${string}]`]: undefined;
        [x: `uint64[${string}]`]: undefined;
        [x: `uint72[${string}]`]: undefined;
        [x: `uint80[${string}]`]: undefined;
        [x: `uint88[${string}]`]: undefined;
        [x: `uint96[${string}]`]: undefined;
        [x: `uint104[${string}]`]: undefined;
        [x: `uint112[${string}]`]: undefined;
        [x: `uint120[${string}]`]: undefined;
        [x: `uint128[${string}]`]: undefined;
        [x: `uint136[${string}]`]: undefined;
        [x: `uint144[${string}]`]: undefined;
        [x: `uint152[${string}]`]: undefined;
        [x: `uint160[${string}]`]: undefined;
        [x: `uint168[${string}]`]: undefined;
        [x: `uint176[${string}]`]: undefined;
        [x: `uint184[${string}]`]: undefined;
        [x: `uint192[${string}]`]: undefined;
        [x: `uint200[${string}]`]: undefined;
        [x: `uint208[${string}]`]: undefined;
        [x: `uint216[${string}]`]: undefined;
        [x: `uint224[${string}]`]: undefined;
        [x: `uint232[${string}]`]: undefined;
        [x: `uint240[${string}]`]: undefined;
        [x: `uint248[${string}]`]: undefined;
        [x: `uint256[${string}]`]: undefined;
        string?: undefined;
        address?: undefined;
        bool?: undefined;
        bytes?: undefined;
        bytes1?: undefined;
        bytes2?: undefined;
        bytes18?: undefined;
        bytes3?: undefined;
        bytes4?: undefined;
        bytes5?: undefined;
        bytes6?: undefined;
        bytes7?: undefined;
        bytes8?: undefined;
        bytes9?: undefined;
        bytes10?: undefined;
        bytes11?: undefined;
        bytes12?: undefined;
        bytes13?: undefined;
        bytes14?: undefined;
        bytes15?: undefined;
        bytes16?: undefined;
        bytes17?: undefined;
        bytes19?: undefined;
        bytes20?: undefined;
        bytes21?: undefined;
        bytes22?: undefined;
        bytes23?: undefined;
        bytes24?: undefined;
        bytes25?: undefined;
        bytes26?: undefined;
        bytes27?: undefined;
        bytes28?: undefined;
        bytes29?: undefined;
        bytes30?: undefined;
        bytes31?: undefined;
        bytes32?: undefined;
        int8?: undefined;
        int16?: undefined;
        int24?: undefined;
        int32?: undefined;
        int40?: undefined;
        int48?: undefined;
        int56?: undefined;
        int64?: undefined;
        int72?: undefined;
        int80?: undefined;
        int88?: undefined;
        int96?: undefined;
        int104?: undefined;
        int112?: undefined;
        int120?: undefined;
        int128?: undefined;
        int136?: undefined;
        int144?: undefined;
        int152?: undefined;
        int160?: undefined;
        int168?: undefined;
        int176?: undefined;
        int184?: undefined;
        int192?: undefined;
        int200?: undefined;
        int208?: undefined;
        int216?: undefined;
        int224?: undefined;
        int232?: undefined;
        int240?: undefined;
        int248?: undefined;
        int256?: undefined;
        uint8?: undefined;
        uint16?: undefined;
        uint24?: undefined;
        uint32?: undefined;
        uint40?: undefined;
        uint48?: undefined;
        uint56?: undefined;
        uint64?: undefined;
        uint72?: undefined;
        uint80?: undefined;
        uint88?: undefined;
        uint96?: undefined;
        uint104?: undefined;
        uint112?: undefined;
        uint120?: undefined;
        uint128?: undefined;
        uint136?: undefined;
        uint144?: undefined;
        uint152?: undefined;
        uint160?: undefined;
        uint168?: undefined;
        uint176?: undefined;
        uint184?: undefined;
        uint192?: undefined;
        uint200?: undefined;
        uint208?: undefined;
        uint216?: undefined;
        uint224?: undefined;
        uint232?: undefined;
        uint240?: undefined;
        uint248?: undefined;
        uint256?: undefined;
    } | {
        [key: string]: unknown;
    }, primaryType extends string>(args: viem.SignTypedDataParameters<typedData, primaryType, undefined>) => Promise<viem.SignTypedDataReturnType>;
    switchChain: (args: viem.SwitchChainParameters) => Promise<void>;
    waitForCallsStatus: (parameters: viem.WaitForCallsStatusParameters) => Promise<viem.WaitForCallsStatusReturnType>;
    watchAsset: (args: viem.WatchAssetParameters) => Promise<viem.WatchAssetReturnType>;
    writeContract: <const abi extends viem.Abi | readonly unknown[], functionName extends viem.ContractFunctionName<abi, "nonpayable" | "payable">, args_1 extends viem.ContractFunctionArgs<abi, "nonpayable" | "payable", functionName>, chainOverride extends viem.Chain | undefined = undefined>(args: viem.WriteContractParameters<abi, functionName, args_1, {
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, undefined, chainOverride>) => Promise<viem.WriteContractReturnType>;
    writeContractSync: <const abi extends viem.Abi | readonly unknown[], functionName extends viem.ContractFunctionName<abi, "nonpayable" | "payable">, args_1 extends viem.ContractFunctionArgs<abi, "nonpayable" | "payable", functionName>, chainOverride extends viem.Chain | undefined = undefined>(args: viem.WriteContractSyncParameters<abi, functionName, args_1, {
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, undefined, chainOverride>) => Promise<viem.WriteContractSyncReturnType>;
    token: {
        approveSync: (parameters: approveSync.Parameters<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, undefined, undefined>) => Promise<{
            owner: `0x${string}`;
            spender: `0x${string}`;
            value: bigint;
            decimals?: number | undefined | undefined;
            formatted?: string | undefined | undefined;
            receipt: viem.TransactionReceipt;
        }>;
        approve: ((parameters: approve.Parameters<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, undefined, undefined>) => Promise<approve.ReturnValue>) & {
            call: (args: approve.Args<{
                blockExplorers: {
                    readonly default: {
                        readonly name: "Coston2 Explorer";
                        readonly url: "https://coston2-explorer.flare.network";
                    };
                };
                blockTime?: number | undefined | undefined;
                contracts?: {
                    [x: string]: viem.ChainContract | {
                        [sourceId: number]: viem.ChainContract | undefined;
                    } | undefined;
                    ensRegistry?: viem.ChainContract | undefined;
                    ensUniversalResolver?: viem.ChainContract | undefined;
                    multicall3?: viem.ChainContract | undefined;
                    erc6492Verifier?: viem.ChainContract | undefined;
                } | undefined;
                ensTlds?: readonly string[] | undefined;
                id: 114;
                name: "Flare Coston2";
                nativeCurrency: {
                    readonly name: "Coston2 FLR";
                    readonly symbol: "C2FLR";
                    readonly decimals: 18;
                };
                experimental_preconfirmationTime?: number | undefined | undefined;
                rpcUrls: {
                    readonly default: {
                        readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                    };
                    readonly public: {
                        readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                    };
                };
                sourceId?: number | undefined | undefined;
                supportsTransactionReplacementDetection?: boolean | undefined | undefined;
                testnet?: boolean | undefined | undefined;
                custom?: Record<string, unknown> | undefined;
                extendSchema?: Record<string, unknown> | undefined;
                fees?: viem.ChainFees<undefined> | undefined;
                formatters?: undefined;
                prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                    client: viem.Client;
                    phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
                }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                    client: viem.Client;
                    phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
                }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                    runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
                }] | undefined;
                serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
                verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
            }, undefined>) => ReturnType<typeof approve.call>;
            estimateGas: (parameters: approve.Parameters<{
                blockExplorers: {
                    readonly default: {
                        readonly name: "Coston2 Explorer";
                        readonly url: "https://coston2-explorer.flare.network";
                    };
                };
                blockTime?: number | undefined | undefined;
                contracts?: {
                    [x: string]: viem.ChainContract | {
                        [sourceId: number]: viem.ChainContract | undefined;
                    } | undefined;
                    ensRegistry?: viem.ChainContract | undefined;
                    ensUniversalResolver?: viem.ChainContract | undefined;
                    multicall3?: viem.ChainContract | undefined;
                    erc6492Verifier?: viem.ChainContract | undefined;
                } | undefined;
                ensTlds?: readonly string[] | undefined;
                id: 114;
                name: "Flare Coston2";
                nativeCurrency: {
                    readonly name: "Coston2 FLR";
                    readonly symbol: "C2FLR";
                    readonly decimals: 18;
                };
                experimental_preconfirmationTime?: number | undefined | undefined;
                rpcUrls: {
                    readonly default: {
                        readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                    };
                    readonly public: {
                        readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                    };
                };
                sourceId?: number | undefined | undefined;
                supportsTransactionReplacementDetection?: boolean | undefined | undefined;
                testnet?: boolean | undefined | undefined;
                custom?: Record<string, unknown> | undefined;
                extendSchema?: Record<string, unknown> | undefined;
                fees?: viem.ChainFees<undefined> | undefined;
                formatters?: undefined;
                prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                    client: viem.Client;
                    phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
                }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                    client: viem.Client;
                    phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
                }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                    runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
                }] | undefined;
                serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
                verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
            }, undefined, undefined>) => Promise<bigint>;
            extractEvent: typeof approve.extractEvent;
            simulate: (parameters: approve.Parameters<{
                blockExplorers: {
                    readonly default: {
                        readonly name: "Coston2 Explorer";
                        readonly url: "https://coston2-explorer.flare.network";
                    };
                };
                blockTime?: number | undefined | undefined;
                contracts?: {
                    [x: string]: viem.ChainContract | {
                        [sourceId: number]: viem.ChainContract | undefined;
                    } | undefined;
                    ensRegistry?: viem.ChainContract | undefined;
                    ensUniversalResolver?: viem.ChainContract | undefined;
                    multicall3?: viem.ChainContract | undefined;
                    erc6492Verifier?: viem.ChainContract | undefined;
                } | undefined;
                ensTlds?: readonly string[] | undefined;
                id: 114;
                name: "Flare Coston2";
                nativeCurrency: {
                    readonly name: "Coston2 FLR";
                    readonly symbol: "C2FLR";
                    readonly decimals: 18;
                };
                experimental_preconfirmationTime?: number | undefined | undefined;
                rpcUrls: {
                    readonly default: {
                        readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                    };
                    readonly public: {
                        readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                    };
                };
                sourceId?: number | undefined | undefined;
                supportsTransactionReplacementDetection?: boolean | undefined | undefined;
                testnet?: boolean | undefined | undefined;
                custom?: Record<string, unknown> | undefined;
                extendSchema?: Record<string, unknown> | undefined;
                fees?: viem.ChainFees<undefined> | undefined;
                formatters?: undefined;
                prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                    client: viem.Client;
                    phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
                }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                    client: viem.Client;
                    phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
                }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                    runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
                }] | undefined;
                serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
                verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
            }, undefined, undefined>) => ReturnType<typeof approve.simulate>;
        };
        transferSync: (parameters: transferSync.Parameters<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, undefined, undefined>) => Promise<{
            from: `0x${string}`;
            to: `0x${string}`;
            value: bigint;
            decimals?: number | undefined | undefined;
            formatted?: string | undefined | undefined;
            receipt: viem.TransactionReceipt;
        }>;
        transfer: ((parameters: transfer.Parameters<{
            blockExplorers: {
                readonly default: {
                    readonly name: "Coston2 Explorer";
                    readonly url: "https://coston2-explorer.flare.network";
                };
            };
            blockTime?: number | undefined | undefined;
            contracts?: {
                [x: string]: viem.ChainContract | {
                    [sourceId: number]: viem.ChainContract | undefined;
                } | undefined;
                ensRegistry?: viem.ChainContract | undefined;
                ensUniversalResolver?: viem.ChainContract | undefined;
                multicall3?: viem.ChainContract | undefined;
                erc6492Verifier?: viem.ChainContract | undefined;
            } | undefined;
            ensTlds?: readonly string[] | undefined;
            id: 114;
            name: "Flare Coston2";
            nativeCurrency: {
                readonly name: "Coston2 FLR";
                readonly symbol: "C2FLR";
                readonly decimals: 18;
            };
            experimental_preconfirmationTime?: number | undefined | undefined;
            rpcUrls: {
                readonly default: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
                readonly public: {
                    readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                };
            };
            sourceId?: number | undefined | undefined;
            supportsTransactionReplacementDetection?: boolean | undefined | undefined;
            testnet?: boolean | undefined | undefined;
            custom?: Record<string, unknown> | undefined;
            extendSchema?: Record<string, unknown> | undefined;
            fees?: viem.ChainFees<undefined> | undefined;
            formatters?: undefined;
            prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                client: viem.Client;
                phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
            }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
            }] | undefined;
            serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
            verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
        }, undefined, undefined>) => Promise<transfer.ReturnValue>) & {
            call: (args: transfer.Args<{
                blockExplorers: {
                    readonly default: {
                        readonly name: "Coston2 Explorer";
                        readonly url: "https://coston2-explorer.flare.network";
                    };
                };
                blockTime?: number | undefined | undefined;
                contracts?: {
                    [x: string]: viem.ChainContract | {
                        [sourceId: number]: viem.ChainContract | undefined;
                    } | undefined;
                    ensRegistry?: viem.ChainContract | undefined;
                    ensUniversalResolver?: viem.ChainContract | undefined;
                    multicall3?: viem.ChainContract | undefined;
                    erc6492Verifier?: viem.ChainContract | undefined;
                } | undefined;
                ensTlds?: readonly string[] | undefined;
                id: 114;
                name: "Flare Coston2";
                nativeCurrency: {
                    readonly name: "Coston2 FLR";
                    readonly symbol: "C2FLR";
                    readonly decimals: 18;
                };
                experimental_preconfirmationTime?: number | undefined | undefined;
                rpcUrls: {
                    readonly default: {
                        readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                    };
                    readonly public: {
                        readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                    };
                };
                sourceId?: number | undefined | undefined;
                supportsTransactionReplacementDetection?: boolean | undefined | undefined;
                testnet?: boolean | undefined | undefined;
                custom?: Record<string, unknown> | undefined;
                extendSchema?: Record<string, unknown> | undefined;
                fees?: viem.ChainFees<undefined> | undefined;
                formatters?: undefined;
                prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                    client: viem.Client;
                    phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
                }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                    client: viem.Client;
                    phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
                }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                    runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
                }] | undefined;
                serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
                verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
            }, undefined>) => ReturnType<typeof transfer.call>;
            estimateGas: (parameters: transfer.Parameters<{
                blockExplorers: {
                    readonly default: {
                        readonly name: "Coston2 Explorer";
                        readonly url: "https://coston2-explorer.flare.network";
                    };
                };
                blockTime?: number | undefined | undefined;
                contracts?: {
                    [x: string]: viem.ChainContract | {
                        [sourceId: number]: viem.ChainContract | undefined;
                    } | undefined;
                    ensRegistry?: viem.ChainContract | undefined;
                    ensUniversalResolver?: viem.ChainContract | undefined;
                    multicall3?: viem.ChainContract | undefined;
                    erc6492Verifier?: viem.ChainContract | undefined;
                } | undefined;
                ensTlds?: readonly string[] | undefined;
                id: 114;
                name: "Flare Coston2";
                nativeCurrency: {
                    readonly name: "Coston2 FLR";
                    readonly symbol: "C2FLR";
                    readonly decimals: 18;
                };
                experimental_preconfirmationTime?: number | undefined | undefined;
                rpcUrls: {
                    readonly default: {
                        readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                    };
                    readonly public: {
                        readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                    };
                };
                sourceId?: number | undefined | undefined;
                supportsTransactionReplacementDetection?: boolean | undefined | undefined;
                testnet?: boolean | undefined | undefined;
                custom?: Record<string, unknown> | undefined;
                extendSchema?: Record<string, unknown> | undefined;
                fees?: viem.ChainFees<undefined> | undefined;
                formatters?: undefined;
                prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                    client: viem.Client;
                    phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
                }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                    client: viem.Client;
                    phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
                }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                    runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
                }] | undefined;
                serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
                verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
            }, undefined, undefined>) => Promise<bigint>;
            extractEvent: typeof transfer.extractEvent;
            simulate: (parameters: transfer.Parameters<{
                blockExplorers: {
                    readonly default: {
                        readonly name: "Coston2 Explorer";
                        readonly url: "https://coston2-explorer.flare.network";
                    };
                };
                blockTime?: number | undefined | undefined;
                contracts?: {
                    [x: string]: viem.ChainContract | {
                        [sourceId: number]: viem.ChainContract | undefined;
                    } | undefined;
                    ensRegistry?: viem.ChainContract | undefined;
                    ensUniversalResolver?: viem.ChainContract | undefined;
                    multicall3?: viem.ChainContract | undefined;
                    erc6492Verifier?: viem.ChainContract | undefined;
                } | undefined;
                ensTlds?: readonly string[] | undefined;
                id: 114;
                name: "Flare Coston2";
                nativeCurrency: {
                    readonly name: "Coston2 FLR";
                    readonly symbol: "C2FLR";
                    readonly decimals: 18;
                };
                experimental_preconfirmationTime?: number | undefined | undefined;
                rpcUrls: {
                    readonly default: {
                        readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                    };
                    readonly public: {
                        readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
                    };
                };
                sourceId?: number | undefined | undefined;
                supportsTransactionReplacementDetection?: boolean | undefined | undefined;
                testnet?: boolean | undefined | undefined;
                custom?: Record<string, unknown> | undefined;
                extendSchema?: Record<string, unknown> | undefined;
                fees?: viem.ChainFees<undefined> | undefined;
                formatters?: undefined;
                prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
                    client: viem.Client;
                    phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
                }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
                    client: viem.Client;
                    phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
                }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
                    runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
                }] | undefined;
                serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
                verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
            }, undefined, undefined>) => ReturnType<typeof transfer.simulate>;
        };
    };
    extend: <const client extends {
        [x: string]: unknown;
        account?: undefined;
        batch?: undefined;
        cacheTime?: undefined;
        ccipRead?: undefined;
        chain?: undefined;
        dataSuffix?: undefined;
        experimental_blockTag?: undefined;
        key?: undefined;
        name?: undefined;
        pollingInterval?: undefined;
        request?: undefined;
        tokens?: undefined;
        transport?: undefined;
        type?: undefined;
        uid?: undefined;
    } & viem.ExactPartial<Pick<viem.PublicActions<viem.CustomTransport, {
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, undefined, undefined>, "prepareTransactionRequest" | "call" | "createContractEventFilter" | "createEventFilter" | "estimateContractGas" | "estimateGas" | "getBlock" | "getBlockNumber" | "getChainId" | "getContractEvents" | "getEnsText" | "getFilterChanges" | "getGasPrice" | "getLogs" | "getTransaction" | "getTransactionCount" | "getTransactionReceipt" | "readContract" | "sendRawTransaction" | "simulateContract" | "uninstallFilter" | "watchBlockNumber" | "watchContractEvent"> & Pick<viem.WalletActions<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, undefined, undefined>, "sendTransaction" | "writeContract">>>(fn: (client: viem.Client<viem.CustomTransport, {
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, undefined, viem.WalletRpcSchema, viem.WalletActions<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, undefined, undefined>, undefined>) => client) => viem.Client<viem.CustomTransport, {
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, undefined, viem.WalletRpcSchema, { [K in keyof client]: client[K]; } & viem.WalletActions<{
        blockExplorers: {
            readonly default: {
                readonly name: "Coston2 Explorer";
                readonly url: "https://coston2-explorer.flare.network";
            };
        };
        blockTime?: number | undefined | undefined;
        contracts?: {
            [x: string]: viem.ChainContract | {
                [sourceId: number]: viem.ChainContract | undefined;
            } | undefined;
            ensRegistry?: viem.ChainContract | undefined;
            ensUniversalResolver?: viem.ChainContract | undefined;
            multicall3?: viem.ChainContract | undefined;
            erc6492Verifier?: viem.ChainContract | undefined;
        } | undefined;
        ensTlds?: readonly string[] | undefined;
        id: 114;
        name: "Flare Coston2";
        nativeCurrency: {
            readonly name: "Coston2 FLR";
            readonly symbol: "C2FLR";
            readonly decimals: 18;
        };
        experimental_preconfirmationTime?: number | undefined | undefined;
        rpcUrls: {
            readonly default: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
            readonly public: {
                readonly http: readonly ["https://coston2-api.flare.network/ext/C/rpc"];
            };
        };
        sourceId?: number | undefined | undefined;
        supportsTransactionReplacementDetection?: boolean | undefined | undefined;
        testnet?: boolean | undefined | undefined;
        custom?: Record<string, unknown> | undefined;
        extendSchema?: Record<string, unknown> | undefined;
        fees?: viem.ChainFees<undefined> | undefined;
        formatters?: undefined;
        prepareTransactionRequest?: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | [fn: ((args: viem.PrepareTransactionRequestParameters, options: {
            client: viem.Client;
            phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
        }) => Promise<viem.PrepareTransactionRequestParameters>) | undefined, options: {
            runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
        }] | undefined;
        serializers?: viem.ChainSerializers<undefined, viem.TransactionSerializable> | undefined;
        verifyHash?: ((client: viem.Client, parameters: viem.VerifyHashActionParameters) => Promise<viem.VerifyHashActionReturnType>) | undefined;
    }, undefined, undefined>, undefined>;
};

declare function getMarkets(indexerUrl: string, params?: {
    status?: 'OPEN' | 'SETTLED';
    region?: string;
    limit?: number;
    offset?: number;
}): Promise<Market[]>;
declare function getMarket(indexerUrl: string, address: string): Promise<Market>;
declare function getMarketPositions(indexerUrl: string, marketAddress: string): Promise<any>;

declare function getUserPositions(indexerUrl: string, walletAddress: string): Promise<Position[]>;

declare function getWeatherReadings(indexerUrl: string, regionId: string, days?: number): Promise<WeatherReading[]>;
declare function getRegions(indexerUrl: string): Promise<any>;

type BreezeRole = 'ADMIN_ROLE' | 'PAUSER_ROLE' | 'ORACLE_UPDATER_ROLE' | 'MARKET_CREATOR_ROLE';
declare function checkRole(publicClient: PublicClient, accessControlAddress: string, role: BreezeRole, account: string): Promise<boolean>;

declare function createMarket(walletClient: WalletClient, publicClient: PublicClient, params: CreateMarketParams): Promise<{
    txHash: `0x${string}`;
    marketAddress: string;
}>;

declare function approveCollateral(walletClient: WalletClient, publicClient: PublicClient, tokenAddress: `0x${string}`, spenderAddress: `0x${string}`, amount: bigint): Promise<`0x${string}` | null>;
declare function mintPosition(walletClient: WalletClient, publicClient: PublicClient, params: MintPositionParams): Promise<`0x${string}`>;
declare function redeem(walletClient: WalletClient, publicClient: PublicClient, marketAddress: `0x${string}`, tokenId: bigint, amount: bigint): Promise<`0x${string}`>;
declare function settle(walletClient: WalletClient, publicClient: PublicClient, marketAddress: `0x${string}`): Promise<`0x${string}`>;

declare function setOracleReading(walletClient: WalletClient, publicClient: PublicClient, oracleAddress: `0x${string}`, regionId: `0x${string}`, timestamp: bigint, value: bigint): Promise<`0x${string}`>;
declare function pauseMarket(walletClient: WalletClient, publicClient: PublicClient, marketAddress: `0x${string}`): Promise<`0x${string}`>;
declare function unpauseMarket(walletClient: WalletClient, publicClient: PublicClient, marketAddress: `0x${string}`): Promise<`0x${string}`>;
declare function pauseFactory(walletClient: WalletClient, publicClient: PublicClient, factoryAddress: `0x${string}`): Promise<`0x${string}`>;
declare function unpauseFactory(walletClient: WalletClient, publicClient: PublicClient, factoryAddress: `0x${string}`): Promise<`0x${string}`>;
declare function grantRole(walletClient: WalletClient, publicClient: PublicClient, accessControlAddress: `0x${string}`, role: BreezeRole, targetAccount: `0x${string}`): Promise<`0x${string}`>;
declare function revokeRole(walletClient: WalletClient, publicClient: PublicClient, accessControlAddress: `0x${string}`, role: BreezeRole, targetAccount: `0x${string}`): Promise<`0x${string}`>;

declare function formatOracleValue(raw: bigint | number, variable: 'RAINFALL' | 'TEMPERATURE'): string;
declare function toOracleUnits(display: number): bigint;
declare function formatPayoutRatio(ratio: number | null): string;
declare function formatCollateral(raw: string | bigint | number | undefined | null, decimals: number, symbol: string): string;
declare function formatExpiry(isoString: string): string;
declare function timeUntilExpiry(isoString: string): string;

declare function encodeRegionId(regionName: string): `0x${string}`;
declare const KNOWN_REGIONS: Record<string, string>;
declare function decodeRegionId(regionId: string): string;

export { type BreezeRole, type BreezeSwapConfig, CONTRACT_ADDRESSES, COSTON2_CHAIN_ID, type CreateMarketParams, KNOWN_REGIONS, type Market, type MarketStatus, type MintPositionParams, ORACLE_DECIMALS, ORACLE_SCALAR, PAYOFF_TYPES, type PayoffType, type Position, SIDES, type Side, WAD, WEATHER_VARIABLES, type WeatherReading, type WeatherVariable, approveCollateral, checkRole, coston2Chain, createBreezePublicClient, createBreezeWalletClient, createMarket, decodeRegionId, encodeRegionId, formatCollateral, formatExpiry, formatOracleValue, formatPayoutRatio, getMarket, getMarketPositions, getMarkets, getRegions, getUserPositions, getWeatherReadings, grantRole, mintPosition, pauseFactory, pauseMarket, redeem, revokeRole, setOracleReading, settle, timeUntilExpiry, toOracleUnits, unpauseFactory, unpauseMarket };
