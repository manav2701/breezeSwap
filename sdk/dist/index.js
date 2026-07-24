"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  CONTRACT_ADDRESSES: () => CONTRACT_ADDRESSES,
  COSTON2_CHAIN_ID: () => COSTON2_CHAIN_ID,
  KNOWN_REGIONS: () => KNOWN_REGIONS,
  ORACLE_DECIMALS: () => ORACLE_DECIMALS,
  ORACLE_SCALAR: () => ORACLE_SCALAR,
  PAYOFF_TYPES: () => PAYOFF_TYPES,
  SIDES: () => SIDES,
  WAD: () => WAD,
  WEATHER_VARIABLES: () => WEATHER_VARIABLES,
  approveCollateral: () => approveCollateral,
  coston2Chain: () => coston2Chain,
  createBreezePublicClient: () => createBreezePublicClient,
  createBreezeWalletClient: () => createBreezeWalletClient,
  createMarket: () => createMarket,
  decodeRegionId: () => decodeRegionId,
  encodeRegionId: () => encodeRegionId,
  formatCollateral: () => formatCollateral,
  formatExpiry: () => formatExpiry,
  formatOracleValue: () => formatOracleValue,
  formatPayoutRatio: () => formatPayoutRatio,
  getMarket: () => getMarket,
  getMarketPositions: () => getMarketPositions,
  getMarkets: () => getMarkets,
  getRegions: () => getRegions,
  getUserPositions: () => getUserPositions,
  getWeatherReadings: () => getWeatherReadings,
  mintPosition: () => mintPosition,
  redeem: () => redeem,
  settle: () => settle,
  timeUntilExpiry: () => timeUntilExpiry,
  toOracleUnits: () => toOracleUnits
});
module.exports = __toCommonJS(index_exports);

// src/constants.ts
var COSTON2_CHAIN_ID = 114;
var CONTRACT_ADDRESSES = {
  [COSTON2_CHAIN_ID]: {
    factory: "0xe8969c988D4CF26AA9A98B8a95fF93D14E80615A",
    positionToken: "0x611653F531D6c584801449548728290EbE298d28",
    mockWeatherOracle: "0x376b26e7C91AE050E48Aa1Ca7233625EA258A3ab",
    mockUsdt: "0x61bB87822841428249405Cc77bcBF004C217fc64",
    fTestXrp: "0x0b6a8e49F600B4676570c99a38e6a68d5d813DC7",
    ftsoWeatherAdapter: "0x112E2Cd1Bd31874E2b24Eb7c75A3bA1408c67b5A",
    fdcWeatherAdapter: "0xA2EF417a007A6E199F757809A7B56Db45c54861b",
    fAssetsCollateralAdapter: "0xf84c832Ca8fdfb9FFCE433A359d959ED6f37Bc7B"
  }
};
var ORACLE_DECIMALS = 6n;
var ORACLE_SCALAR = 10n ** ORACLE_DECIMALS;
var WAD = 10n ** 18n;
var WEATHER_VARIABLES = {
  RAINFALL: 0,
  TEMPERATURE: 1
};
var PAYOFF_TYPES = {
  BINARY: 0,
  LINEAR: 1,
  CAPPED: 2
};
var SIDES = {
  LONG: 0,
  SHORT: 1
};

// src/chain.ts
var import_viem = require("viem");
var coston2Chain = (0, import_viem.defineChain)({
  id: 114,
  name: "Flare Coston2",
  nativeCurrency: { name: "Coston2 FLR", symbol: "C2FLR", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://coston2-api.flare.network/ext/C/rpc"] },
    public: { http: ["https://coston2-api.flare.network/ext/C/rpc"] }
  },
  blockExplorers: {
    default: { name: "Coston2 Explorer", url: "https://coston2-explorer.flare.network" }
  }
});
function createBreezePublicClient(rpcUrl) {
  return (0, import_viem.createPublicClient)({
    chain: coston2Chain,
    transport: (0, import_viem.http)(rpcUrl ?? "https://coston2-api.flare.network/ext/C/rpc")
  });
}
function createBreezeWalletClient(provider) {
  return (0, import_viem.createWalletClient)({
    chain: coston2Chain,
    transport: (0, import_viem.custom)(provider)
  });
}

// src/reads/markets.ts
async function getMarkets(indexerUrl, params) {
  const url = new URL(`${indexerUrl}/api/markets`);
  if (params?.status) url.searchParams.set("status", params.status);
  if (params?.region) url.searchParams.set("region", params.region);
  if (params?.limit) url.searchParams.set("limit", String(params.limit));
  if (params?.offset) url.searchParams.set("offset", String(params.offset));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Failed to fetch markets: ${res.statusText}`);
  const data = await res.json();
  return data.markets || [];
}
async function getMarket(indexerUrl, address) {
  const res = await fetch(`${indexerUrl}/api/markets/${address.toLowerCase()}`);
  if (!res.ok) throw new Error(`Market not found: ${address}`);
  return res.json();
}
async function getMarketPositions(indexerUrl, marketAddress) {
  const res = await fetch(`${indexerUrl}/api/markets/${marketAddress.toLowerCase()}/positions`);
  if (!res.ok) throw new Error(`Failed to fetch positions for market: ${marketAddress}`);
  const data = await res.json();
  return data.positions || [];
}

// src/reads/positions.ts
async function getUserPositions(indexerUrl, walletAddress) {
  const res = await fetch(`${indexerUrl}/api/users/${walletAddress.toLowerCase()}/positions`);
  if (!res.ok) throw new Error(`Failed to fetch positions for user: ${walletAddress}`);
  const data = await res.json();
  return data.positions || [];
}

// src/reads/weather.ts
async function getWeatherReadings(indexerUrl, regionId, days = 30) {
  const res = await fetch(`${indexerUrl}/api/weather/${regionId}?days=${days}`);
  if (!res.ok) throw new Error(`Failed to fetch weather data for region: ${regionId}`);
  const data = await res.json();
  return (data.readings || []).map((r) => ({
    regionId,
    regionName: r.region_name || null,
    variable: r.variable || "RAINFALL",
    value: r.displayValue ?? Number(r.value) / 1e6,
    readingTimestamp: r.reading_timestamp
  }));
}
async function getRegions(indexerUrl) {
  const res = await fetch(`${indexerUrl}/api/weather/regions`);
  if (!res.ok) throw new Error("Failed to fetch regions");
  const data = await res.json();
  return data.regions || [];
}

// src/writes/markets.ts
var import_viem2 = require("viem");

// src/abis/BreezeMarketFactory.json
var BreezeMarketFactory_default = [
  {
    type: "constructor",
    inputs: [
      {
        name: "sharedPositionToken_",
        type: "address",
        internalType: "address"
      }
    ],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "allMarkets",
    inputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256"
      }
    ],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "address"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "createMarket",
    inputs: [
      {
        name: "regionId",
        type: "bytes32",
        internalType: "bytes32"
      },
      {
        name: "weatherVariable",
        type: "uint8",
        internalType: "enum BreezeMarket.WeatherVariable"
      },
      {
        name: "thresholdLow",
        type: "int256",
        internalType: "int256"
      },
      {
        name: "thresholdHigh",
        type: "int256",
        internalType: "int256"
      },
      {
        name: "expiryTimestamp",
        type: "uint256",
        internalType: "uint256"
      },
      {
        name: "oracleAddress",
        type: "address",
        internalType: "address"
      },
      {
        name: "collateralToken",
        type: "address",
        internalType: "address"
      },
      {
        name: "payoffType",
        type: "uint8",
        internalType: "enum PayoffCalculator.PayoffType"
      }
    ],
    outputs: [
      {
        name: "marketAddress",
        type: "address",
        internalType: "address"
      }
    ],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "getMarketCount",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "isMarket",
    inputs: [
      {
        name: "",
        type: "address",
        internalType: "address"
      }
    ],
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "address"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "renounceOwnership",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "sharedPositionToken",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "contract PositionToken"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "transferOwnership",
    inputs: [
      {
        name: "newOwner",
        type: "address",
        internalType: "address"
      }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "event",
    name: "MarketCreated",
    inputs: [
      {
        name: "market",
        type: "address",
        indexed: true,
        internalType: "address"
      },
      {
        name: "regionId",
        type: "bytes32",
        indexed: true,
        internalType: "bytes32"
      },
      {
        name: "expiryTimestamp",
        type: "uint256",
        indexed: false,
        internalType: "uint256"
      },
      {
        name: "collateralToken",
        type: "address",
        indexed: false,
        internalType: "address"
      },
      {
        name: "payoffType",
        type: "uint8",
        indexed: false,
        internalType: "enum PayoffCalculator.PayoffType"
      }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "OwnershipTransferred",
    inputs: [
      {
        name: "previousOwner",
        type: "address",
        indexed: true,
        internalType: "address"
      },
      {
        name: "newOwner",
        type: "address",
        indexed: true,
        internalType: "address"
      }
    ],
    anonymous: false
  },
  {
    type: "error",
    name: "InvalidParameters",
    inputs: []
  },
  {
    type: "error",
    name: "OwnableInvalidOwner",
    inputs: [
      {
        name: "owner",
        type: "address",
        internalType: "address"
      }
    ]
  },
  {
    type: "error",
    name: "OwnableUnauthorizedAccount",
    inputs: [
      {
        name: "account",
        type: "address",
        internalType: "address"
      }
    ]
  }
];

// src/writes/markets.ts
async function createMarket(walletClient, publicClient, params) {
  const [account] = await walletClient.getAddresses();
  if (!account) throw new Error("No wallet connected");
  const factoryAddress = CONTRACT_ADDRESSES[COSTON2_CHAIN_ID].factory;
  const oracleAddress = params.oracleAddress || CONTRACT_ADDRESSES[COSTON2_CHAIN_ID].mockWeatherOracle;
  const { request } = await publicClient.simulateContract({
    address: factoryAddress,
    abi: BreezeMarketFactory_default,
    functionName: "createMarket",
    args: [
      params.regionId,
      WEATHER_VARIABLES[params.weatherVariable],
      params.thresholdLow,
      params.thresholdHigh,
      params.expiryTimestamp,
      oracleAddress,
      params.collateralToken,
      PAYOFF_TYPES[params.payoffType]
    ],
    account
  });
  const txHash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  let marketAddress = "";
  for (const log of receipt.logs) {
    try {
      const decoded = (0, import_viem2.decodeEventLog)({
        abi: BreezeMarketFactory_default,
        data: log.data,
        topics: log.topics
      });
      if (decoded.eventName === "MarketCreated") {
        marketAddress = decoded.args.market;
        break;
      }
    } catch {
    }
  }
  return { txHash, marketAddress };
}

// src/abis/BreezeMarket.json
var BreezeMarket_default = [
  {
    type: "constructor",
    inputs: [
      {
        name: "regionId_",
        type: "bytes32",
        internalType: "bytes32"
      },
      {
        name: "weatherVariable_",
        type: "uint8",
        internalType: "enum BreezeMarket.WeatherVariable"
      },
      {
        name: "thresholdLow_",
        type: "int256",
        internalType: "int256"
      },
      {
        name: "thresholdHigh_",
        type: "int256",
        internalType: "int256"
      },
      {
        name: "expiryTimestamp_",
        type: "uint256",
        internalType: "uint256"
      },
      {
        name: "oracleAddress_",
        type: "address",
        internalType: "address"
      },
      {
        name: "collateralToken_",
        type: "address",
        internalType: "address"
      },
      {
        name: "positionTokenAddress_",
        type: "address",
        internalType: "address"
      },
      {
        name: "payoffType_",
        type: "uint8",
        internalType: "enum PayoffCalculator.PayoffType"
      }
    ],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "collateralToken",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "contract IERC20"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "expiryTimestamp",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "finalOracleValue",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "int256",
        internalType: "int256"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "longPayoutPerToken",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "mintPosition",
    inputs: [
      {
        name: "side",
        type: "uint8",
        internalType: "enum PositionToken.Side"
      },
      {
        name: "collateralAmount",
        type: "uint256",
        internalType: "uint256"
      }
    ],
    outputs: [
      {
        name: "tokenId",
        type: "uint256",
        internalType: "uint256"
      }
    ],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "oracle",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "contract IWeatherOracle"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "payoffType",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint8",
        internalType: "enum PayoffCalculator.PayoffType"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "positionToken",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "contract PositionToken"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "redeem",
    inputs: [
      {
        name: "tokenId",
        type: "uint256",
        internalType: "uint256"
      },
      {
        name: "amount",
        type: "uint256",
        internalType: "uint256"
      }
    ],
    outputs: [
      {
        name: "payout",
        type: "uint256",
        internalType: "uint256"
      }
    ],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "regionId",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "bytes32",
        internalType: "bytes32"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "settle",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "shortPayoutPerToken",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "status",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint8",
        internalType: "enum BreezeMarket.Status"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "thresholdHigh",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "int256",
        internalType: "int256"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "thresholdLow",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "int256",
        internalType: "int256"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "totalCollateral",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "totalLongSupply",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "totalShortSupply",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "vault",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "contract CollateralVault"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "weatherVariable",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint8",
        internalType: "enum BreezeMarket.WeatherVariable"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "event",
    name: "MarketSettled",
    inputs: [
      {
        name: "oracleValue",
        type: "int256",
        indexed: false,
        internalType: "int256"
      },
      {
        name: "longPayoutPerToken",
        type: "uint256",
        indexed: false,
        internalType: "uint256"
      },
      {
        name: "shortPayoutPerToken",
        type: "uint256",
        indexed: false,
        internalType: "uint256"
      }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "PositionMinted",
    inputs: [
      {
        name: "user",
        type: "address",
        indexed: true,
        internalType: "address"
      },
      {
        name: "side",
        type: "uint8",
        indexed: false,
        internalType: "enum PositionToken.Side"
      },
      {
        name: "collateralAmount",
        type: "uint256",
        indexed: false,
        internalType: "uint256"
      },
      {
        name: "tokenId",
        type: "uint256",
        indexed: false,
        internalType: "uint256"
      }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "PositionRedeemed",
    inputs: [
      {
        name: "user",
        type: "address",
        indexed: true,
        internalType: "address"
      },
      {
        name: "tokenId",
        type: "uint256",
        indexed: false,
        internalType: "uint256"
      },
      {
        name: "amount",
        type: "uint256",
        indexed: false,
        internalType: "uint256"
      },
      {
        name: "payout",
        type: "uint256",
        indexed: false,
        internalType: "uint256"
      }
    ],
    anonymous: false
  },
  {
    type: "error",
    name: "InvalidOracleData",
    inputs: []
  },
  {
    type: "error",
    name: "InvalidParameters",
    inputs: []
  },
  {
    type: "error",
    name: "InvalidThresholds",
    inputs: []
  },
  {
    type: "error",
    name: "MarketAlreadySettled",
    inputs: []
  },
  {
    type: "error",
    name: "MarketExpired",
    inputs: []
  },
  {
    type: "error",
    name: "MarketNotExpired",
    inputs: []
  },
  {
    type: "error",
    name: "MarketNotSettled",
    inputs: []
  },
  {
    type: "error",
    name: "OracleDataStale",
    inputs: []
  },
  {
    type: "error",
    name: "ReentrancyGuardReentrantCall",
    inputs: []
  },
  {
    type: "error",
    name: "Unauthorized",
    inputs: []
  },
  {
    type: "error",
    name: "ZeroAmount",
    inputs: []
  }
];

// src/abis/ERC20.json
var ERC20_default = [
  {
    constant: true,
    inputs: [
      {
        name: "_owner",
        type: "address"
      },
      {
        name: "_spender",
        type: "address"
      }
    ],
    name: "allowance",
    outputs: [
      {
        name: "remaining",
        type: "uint256"
      }
    ],
    type: "function"
  },
  {
    constant: false,
    inputs: [
      {
        name: "_spender",
        type: "address"
      },
      {
        name: "_value",
        type: "uint256"
      }
    ],
    name: "approve",
    outputs: [
      {
        name: "success",
        type: "bool"
      }
    ],
    type: "function"
  },
  {
    constant: true,
    inputs: [
      {
        name: "_owner",
        type: "address"
      }
    ],
    name: "balanceOf",
    outputs: [
      {
        name: "balance",
        type: "uint256"
      }
    ],
    type: "function"
  },
  {
    constant: true,
    inputs: [],
    name: "decimals",
    outputs: [
      {
        name: "",
        type: "uint8"
      }
    ],
    type: "function"
  },
  {
    constant: true,
    inputs: [],
    name: "symbol",
    outputs: [
      {
        name: "",
        type: "string"
      }
    ],
    type: "function"
  }
];

// src/writes/positions.ts
async function approveCollateral(walletClient, publicClient, tokenAddress, spenderAddress, amount) {
  const [account] = await walletClient.getAddresses();
  if (!account) throw new Error("No wallet connected");
  const { request } = await publicClient.simulateContract({
    address: tokenAddress,
    abi: ERC20_default,
    functionName: "approve",
    args: [spenderAddress, amount],
    account
  });
  return walletClient.writeContract(request);
}
async function mintPosition(walletClient, publicClient, params) {
  const [account] = await walletClient.getAddresses();
  if (!account) throw new Error("No wallet connected");
  const { request } = await publicClient.simulateContract({
    address: params.marketAddress,
    abi: BreezeMarket_default,
    functionName: "mintPosition",
    args: [SIDES[params.side], params.collateralAmount],
    account
  });
  return walletClient.writeContract(request);
}
async function redeem(walletClient, publicClient, marketAddress, tokenId, amount) {
  const [account] = await walletClient.getAddresses();
  if (!account) throw new Error("No wallet connected");
  const { request } = await publicClient.simulateContract({
    address: marketAddress,
    abi: BreezeMarket_default,
    functionName: "redeem",
    args: [tokenId, amount],
    account
  });
  return walletClient.writeContract(request);
}
async function settle(walletClient, publicClient, marketAddress) {
  const [account] = await walletClient.getAddresses();
  if (!account) throw new Error("No wallet connected");
  const { request } = await publicClient.simulateContract({
    address: marketAddress,
    abi: BreezeMarket_default,
    functionName: "settle",
    args: [],
    account
  });
  return walletClient.writeContract(request);
}

// src/utils/formatting.ts
function formatOracleValue(raw, variable) {
  const display = Number(raw) / Number(ORACLE_SCALAR);
  if (variable === "RAINFALL") return `${display.toFixed(1)} mm`;
  return `${display.toFixed(1)} \xB0C`;
}
function toOracleUnits(display) {
  return BigInt(Math.round(display * Number(ORACLE_SCALAR)));
}
function formatPayoutRatio(ratio) {
  if (ratio === null) return "\u2014";
  return `${(ratio * 100).toFixed(1)}%`;
}
function formatCollateral(raw, decimals, symbol) {
  const display = Number(BigInt(raw)) / Math.pow(10, decimals);
  return `${display.toLocaleString(void 0, { maximumFractionDigits: 2 })} ${symbol}`;
}
function formatExpiry(isoString) {
  return new Date(isoString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}
function timeUntilExpiry(isoString) {
  const diff = new Date(isoString).getTime() - Date.now();
  if (diff < 0) return "Expired";
  const days = Math.floor(diff / 864e5);
  const hours = Math.floor(diff % 864e5 / 36e5);
  if (days > 0) return `${days}d ${hours}h remaining`;
  return `${hours}h remaining`;
}

// src/utils/regions.ts
var import_viem3 = require("viem");
function encodeRegionId(regionName) {
  return (0, import_viem3.keccak256)((0, import_viem3.toHex)(regionName));
}
var KNOWN_REGIONS = {
  [encodeRegionId("Tokyo")]: "Tokyo",
  [encodeRegionId("Seoul")]: "Seoul",
  [encodeRegionId("Singapore")]: "Singapore",
  [encodeRegionId("Dubai")]: "Dubai",
  [encodeRegionId("London")]: "London",
  [encodeRegionId("TOKYO_RAINFALL")]: "Tokyo",
  [encodeRegionId("SEOUL_RAINFALL")]: "Seoul",
  [encodeRegionId("SINGAPORE_RAINFALL")]: "Singapore",
  [encodeRegionId("DUBAI_TEMPERATURE")]: "Dubai",
  [encodeRegionId("LONDON_RAINFALL")]: "London"
};
function decodeRegionId(regionId) {
  return KNOWN_REGIONS[regionId.toLowerCase()] ?? KNOWN_REGIONS[regionId] ?? "Unknown Region";
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CONTRACT_ADDRESSES,
  COSTON2_CHAIN_ID,
  KNOWN_REGIONS,
  ORACLE_DECIMALS,
  ORACLE_SCALAR,
  PAYOFF_TYPES,
  SIDES,
  WAD,
  WEATHER_VARIABLES,
  approveCollateral,
  coston2Chain,
  createBreezePublicClient,
  createBreezeWalletClient,
  createMarket,
  decodeRegionId,
  encodeRegionId,
  formatCollateral,
  formatExpiry,
  formatOracleValue,
  formatPayoutRatio,
  getMarket,
  getMarketPositions,
  getMarkets,
  getRegions,
  getUserPositions,
  getWeatherReadings,
  mintPosition,
  redeem,
  settle,
  timeUntilExpiry,
  toOracleUnits
});
