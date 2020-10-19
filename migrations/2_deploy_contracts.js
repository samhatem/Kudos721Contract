var Kudos = artifacts.require("./Kudos.sol");

module.exports = async function(deployer) {
  const instance = await deployer.deploy(Kudos);
};
