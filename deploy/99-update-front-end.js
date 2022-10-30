const { network, ethers } = require('hardhat');
const fs = require('fs-extra');
const path = require('path');

const frontEndDir = path.resolve(__dirname, '../../web3-lottery-nextjs');
const FRONT_END_ADDRESSES_FILE = path.resolve(
  frontEndDir,
  'constants/contractAddresses.json'
);
const FRONT_END_ABI_FILE = path.resolve(frontEndDir, 'constants/abi.json');

module.exports = async () => {
  if (process.env.UPDATE_FRONT_END) {
    console.log('>>>>>> Updating front end ...');
    const raffle = await ethers.getContract('Raffle');

    await updateContractAddresses(raffle);
    await updateAbi(raffle);
  }
};

async function updateAbi(contract) {
  const contractInterface = contract['interface'];
  const abiData = contractInterface.format(ethers.utils.FormatTypes.json);

  try {
    fs.writeFileSync(FRONT_END_ABI_FILE, abiData);
    console.log('>>>>>> Front end ABI updated!');
  } catch (error) {
    console.log('>>>>>> Front end ABI update failed!');
    console.error(error);
  }

  console.log('--------------------------------------------------');
}

async function updateContractAddresses(contract) {
  const addressData = fs.readFileSync(FRONT_END_ADDRESSES_FILE, {
    encoding: 'utf-8',
  });
  const addressRecords = JSON.parse(addressData);
  const contractAddress = contract['address'];
  const chainId = network.config.chainId.toString();

  if (chainId in addressRecords) {
    if (!addressRecords[chainId].includes(contractAddress)) {
      addressRecords[chainId].push(contractAddress);
    }
  } else {
    addressRecords[chainId] = [contractAddress];
  }

  try {
    fs.writeFileSync(
      FRONT_END_ADDRESSES_FILE,
      JSON.stringify(addressRecords, null, 2)
    );

    console.log('>>>>>> Front end addresses updated!');
  } catch (error) {
    console.log('>>>>>> Front end addresses update failed!');
    console.error(error);
  }

  console.log('--------------------------------------------------');
}

module.exports.tags = ['all', 'frontend'];
