require('@nomicfoundation/hardhat-toolbox');
require('hardhat-deploy');
require('hardhat-contract-sizer');
require('dotenv').config();

const { RINKEBY_RPC_URL, PRIVATE_KEY, ETHERSCAN_API_KEY } = process.env;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    compilers: [{ version: '0.8.8' }, { version: '0.8.4' }],
  },
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      chainId: 31337,
      blockConfirmations: 1,
    },
    rinkeby: {
      chainId: 4,
      blockConfirmations: 6,
      url: RINKEBY_RPC_URL,
      accounts: [PRIVATE_KEY],
    },
    // localhost: {
    //   chainId: 31137,
    //   url: 'http://127.0.0.1:8545'
    // }
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
    player: {
      default: 1,
    },
  },
  etherscan: {
    // apiKey: ETHERSCAN_API_KEY,
    apiKey: {
      rinkeby: ETHERSCAN_API_KEY,
    },
    customChains: [
      {
        network: 'rinkeby',
        chainId: 4,
        urls: {
          apiURL: 'http://api-rinkeby.etherscan.io/api',
          browserURL: 'https://rinkeby.etherscan.io',
        },
      },
    ],
  },
  gasReporter: {
    enabled: false, // set to true when needs a report
    outputFile: 'gas-report.md',
    noColors: true,
    // currency: 'USD',
    token: 'MATIC',
  },
  mocha: {
    timeout: 200000, // ms
  },
};
