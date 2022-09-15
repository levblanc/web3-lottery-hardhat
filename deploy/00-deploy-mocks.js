const { network, ethers } = require('hardhat');
const { developmentChains } = require('../helper-hardhat-config');

// 0.25 is the premium. It costs 0.25 LINK
const BASE_FEE = ethers.utils.parseEther('0.25');
// Chainlink Nodes pay the gas fees to give us randomness & do external execution
// So the price of requests change based on the price of gas
// LINK per gas. Calculated value based on the gas price of the chain
const GAS_PRICE_LINK = 1e9; // 1000000000

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const args = [BASE_FEE, GAS_PRICE_LINK];

  if (developmentChains.includes(network.name)) {
    log('>>>>>> Local network detected! Deploying mocks...');

    await deploy('VRFCoordinatorV2Mock', {
      contract: '',
      from: deployer,
      log: true,
      args,
    });

    log('>>>>>> Mocks deployed!');
    log('--------------------------------------------------');
  }
};

module.exports.tags = ['all', 'mocks'];
