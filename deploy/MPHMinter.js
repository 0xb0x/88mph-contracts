const BigNumber = require("bignumber.js");
const config = require("../deploy-configs/get-network-config");

module.exports = async ({ web3, getNamedAccounts, deployments, artifacts }) => {
  const { deploy, log, get } = deployments;
  const { deployer } = await getNamedAccounts();

  const vesting02Deployment = await get("Vesting02");

  const deployResult = await deploy("MPHMinter", {
    from: deployer,
    proxy: {
      owner: config.govTimelock,
      proxyContract: "OptimizedTransparentProxy",
      execute: {
        init: {
          methodName: "initialize",
          args: [
            config.mph,
            config.govTreasury,
            config.devWallet,
            vesting02Deployment.address,
            BigNumber(config.devRewardMultiplier).toFixed(),
            BigNumber(config.govRewardMultiplier).toFixed()
          ]
        }
      }
    }
  });
  if (deployResult.newlyDeployed) {
    const MPHMinter = artifacts.require("MPHMinter");
    const contract = await MPHMinter.at(deployResult.address);
    log(`MPHMinter deployed at ${deployResult.address}`);

    // give roles to gov treasury
    const DEFAULT_ADMIN_ROLE = "0x00";
    const WHITELISTER_ROLE = web3.utils.soliditySha3("WHITELISTER_ROLE");
    await contract.grantRole(DEFAULT_ADMIN_ROLE, config.govTreasury, {
      from: deployer
    });
    log(`Grant MPHMinter DEFAULT_ADMIN_ROLE to ${config.govTreasury}`);
    await contract.grantRole(WHITELISTER_ROLE, config.govTreasury, {
      from: deployer
    });
    log(`Grant MPHMinter WHITELISTER_ROLE to ${config.govTreasury}`);
    await contract.renounceRole(DEFAULT_ADMIN_ROLE, deployer, {
      from: deployer
    });
    log(`Renounce MPHMinter DEFAULT_ADMIN_ROLE of ${deployer}`);

    // set MPHMinter address for Vesting02
    const Vesting02 = artifacts.require("Vesting02");
    const vesting02Contract = await Vesting02.at(vesting02Deployment.address);
    await vesting02Contract.setMPHMinter(deployResult.address, {
      from: deployer
    });
    log(`Set MPHMinter in Vesting02 to ${deployResult.address}`);

    // transfer Vesting02 ownership to gov treasury
    await vesting02Contract.transferOwnership(config.govTreasury, true, false, {
      from: deployer
    });
    log(`Transfer Vesting02 ownership to ${config.govTreasury}`);
  }
};
module.exports.tags = ["MPHMinter", "MPHRewards"];
module.exports.dependencies = ["Vesting02"];
