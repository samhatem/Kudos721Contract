const Kudos = artifacts.require("Kudos");

contract("KudosTest", async(accounts) => {
  let priceFinney = 2;
  let priceWeiBN = web3.utils.toBN(web3.utils.toWei(priceFinney.toString(), 'finney'));
  let numClonesAllowed = 10;
  let tokenURI = 'http://example.com';

  let mintAddress = accounts[0];

  let gasPrice = web3.eth.gasPrice;

  it("should mint a new kudos to a different address", async () => {
    // Mint a new Gen0 Kudos
    // TODO: This block is repeated for each test.  Should be able to use the beforeEach hook,
    // but there was some issues with variables from one test polluting the other.
    let instance = await Kudos.deployed();
    await instance.mint(accounts[1], priceFinney, numClonesAllowed, tokenURI, {"from": accounts[0]});
    let kudos_id = (await instance.getLatestId()).toNumber();

    // kinda hacky but we get the return var back twice
    const retreivedKudos = Object.values(await instance.getKudosById(kudos_id))
    let kudos = retreivedKudos.map((x, i, arr) => {
      if (i < (arr.length / 2)) return null
      return x.toNumber()
    });
    kudos = kudos.filter(k => k !== null)
    let expected_kudos = [priceFinney, numClonesAllowed, 0, kudos_id];
    assert.deepEqual(kudos, expected_kudos);
    assert.equal(await instance.tokenURI(kudos_id), tokenURI);
    assert.equal(await instance.ownerOf(kudos_id), accounts[1]);
  });

  it("should not allow minting if not contract owner", async () => {
    // Mint a new Gen0 Kudos
    // accounts[0] is the contract owner, so accounts[1] should not be able to mint
    let instance = await Kudos.deployed();

    try {
      await instance.mint(accounts[1], priceFinney, numClonesAllowed, tokenURI, {"from": accounts[1]});
      assert.fail();
    } catch (err) {
      assert.ok(err);
    }
  });

  it("should allow the contract owner to change the cloneFeePercentage", async () => {
    // Mint a new Gen0 Kudos
    let instance = await Kudos.deployed();
    let newFee = 20;
    await instance.setCloneFeePercentage(newFee);
    let fee = await instance.cloneFeePercentage();
    assert.equal(fee, newFee);
  });

  it("should clone the kudos, given the proper amount of ETH", async () => {
    // Mint a new Gen0 Kudos
    let instance = await Kudos.deployed();
    // contract owner -- accounts[0]
    // gen0 token owner -- accounts[1]
    // clone sender (pays for clone) [2]
    // new clone owner -- accounts[3]
    await instance.mint(accounts[1], priceFinney, numClonesAllowed, tokenURI, {"from": accounts[0]});
    let kudos_id = (await instance.getLatestId()).toNumber();

    let numClones = 1;
    let contractOwnerBalance = web3.utils.toBN(await web3.eth.getBalance(accounts[0]));
    let tokenOwnerBalance = web3.utils.toBN(await web3.eth.getBalance(accounts[1]));
    let cloneSenderBalance = web3.utils.toBN(await web3.eth.getBalance(accounts[2]));

    let txid = await instance.clone(accounts[3], kudos_id, numClones, {"from": accounts[2], "value": web3.utils.toWei('4', 'finney')});
    // console.log(txid)
    let tx = web3.eth.getTransaction(txid['tx']);
    // console.log(tx);

    let cloned_id = (await instance.getLatestId()).toNumber();

    // Check that the cloned_id is what we expect
    assert.equal(cloned_id, kudos_id + 1);

    // Check that the return kudos matches what we expect
    const retreivedKudos = Object.values(await instance.getKudosById(cloned_id))
    let cloned_kudos = retreivedKudos.map((x, i, arr) => {
      if (i < (arr.length / 2)) return null
      return x.toNumber()
    });
    cloned_kudos = cloned_kudos.filter(k => k !== null)
    let expected_cloned_kudos = [priceFinney, 0, 0, kudos_id];
    assert.deepEqual(cloned_kudos, expected_cloned_kudos);

    // Check that the original kudos numClonesInWild has been updated
    let numClonesInWild = (await instance.getNumClonesInWild(kudos_id)).toNumber();
    assert.equal(numClonesInWild, numClones);

    // Check that the owner of the new clone is what we expect
    let owner = await instance.ownerOf(cloned_id);
    assert.equal(owner, accounts[3]);

    let feePercentage = await instance.cloneFeePercentage();

    // Check that the cloneFeePercentage went to the contract owner
    let contractOwnerFee = priceWeiBN.mul(feePercentage).div(web3.utils.toBN('100'));
    let newContractOwnerBalance = web3.utils.toBN(await web3.eth.getBalance(accounts[0]));
    let ownerFeeCheck = (newContractOwnerBalance.sub(web3.utils.toBN(contractOwnerBalance))).eq(contractOwnerFee);
    assert.ok(ownerFeeCheck);

    // Check that the tokenOwnerFee over to the original token owner
    let tokenOwnerFee = priceWeiBN.sub(contractOwnerFee);
    let newTokenOwnerBalance = web3.utils.toBN(await web3.eth.getBalance(accounts[1]));
    let tokenFeeCheck = (newTokenOwnerBalance.sub(tokenOwnerBalance)).eq(tokenOwnerFee);
    assert.ok(tokenOwnerFee);

    // Check that the remaining funds (if any) went back to msg.sender
    let txInfo = await web3.eth.getTransaction(txid.receipt.transactionHash)
    let gasPrice = web3.utils.toBN(txInfo.gasPrice)
    let gasCost = web3.utils.toBN(txid['receipt']['gasUsed'].toString()).mul(gasPrice)
    let allFees = contractOwnerFee.add(tokenOwnerFee);
    let cloneSenderBalanceMinusFeesMinusGas = cloneSenderBalance.sub(allFees).sub(gasCost);
    let newCloneSenderBalance = web3.utils.toBN(await web3.eth.getBalance(accounts[2]));

    // console.log('cloneSender info:');
    // let params = {
    //   cloneSenderBalance: cloneSenderBalance.toNumber(),
    //   allFees: allFees.toNumber(),
    //   gasPrice: tx['gasPrice'].toNumber(),
    //   gasCost: gasCost.toNumber(),
    //   newCloneSenderBalance: newCloneSenderBalance.toNumber()
    // }
    // console.log(params);

    // new balance = new balance - fees - gas


    let cloneSenderBalanceCheck = (newCloneSenderBalance.eq(cloneSenderBalanceMinusFeesMinusGas));
    assert.ok(cloneSenderBalanceCheck);
  });

  it("should set the priceFinney of the kudos", async () => {
    // Mint a new Gen0 Kudos
    let instance = await Kudos.deployed();
    await instance.mint(mintAddress, priceFinney, numClonesAllowed, tokenURI, {"from": accounts[0]});
    let kudos_id = (await instance.getLatestId()).toNumber();

    let newPriceFinney = 5;
    await instance.setPrice(kudos_id, newPriceFinney);

    const retreivedKudos = Object.values(await instance.getKudosById(kudos_id))
    let kudos = retreivedKudos.map((x, i, arr) => {
      if (i < (arr.length / 2)) return null
      return x.toNumber()
    });
    kudos = kudos.filter(k => k !== null)
    assert.equal(kudos[0], newPriceFinney);
  });

  it("should make 5 clones at once", async () => {
    // Mint a new Gen0 Kudos
    let instance = await Kudos.deployed();
    await instance.mint(mintAddress, priceFinney, numClonesAllowed, tokenURI, {"from": accounts[0]});
    let kudos_id = (await instance.getLatestId()).toNumber();

    let startSupply = (await instance.totalSupply()).toNumber();
    let originalBalance = await web3.eth.getBalance(accounts[0]);
    let numClones = 5;
    let msgValue = web3.utils.toWei((priceFinney * numClones).toString(), 'finney');
    await instance.clone(accounts[1], kudos_id, numClones, {"from": accounts[1], "value": msgValue});
    let cloned_id = (await instance.getLatestId()).toNumber();
    let endSupply = (await instance.totalSupply()).toNumber();

    // Check that we made the right number of clones
    assert.ok(endSupply - startSupply == numClones);

    // Check that the original kudos numClonesInWild has been updated
    let numClonesInWild = (await instance.getNumClonesInWild(kudos_id)).toNumber();
    assert.equal(numClonesInWild, numClones);
  });

  it("should burn the kudos token", async () => {
    // Mint a new Gen0 Kudos
    let instance = await Kudos.deployed();
    await instance.mint(mintAddress, priceFinney, numClonesAllowed, tokenURI, {"from": accounts[0]});
    let kudos_id = (await instance.getLatestId()).toNumber();

    let numClones = 1;
    await instance.clone(accounts[4], kudos_id, numClones, {"from": accounts[3], "value": web3.utils.toWei(priceFinney.toString(), 'finney')});
    let startSupply = (await instance.totalSupply()).toNumber();
    // Balance of account[4] should be 1
    assert.equal(await instance.balanceOf(accounts[3]), 1)

    // Burn the new clone
    let clone_id = (await instance.getLatestId()).toNumber();
    await instance.burn(clone_id);

    // Balance of accounts[4] should be 0
    assert.equal(await instance.balanceOf(accounts[4]), 0)

    // Total Supply should decrease by 1
    let endSupply = (await instance.totalSupply()).toNumber();
    assert.equal(endSupply, startSupply - 1);

    // The kudos that was burned should be all 0's because it was deleted
    const retreivedKudos = Object.values(await instance.getKudosById(clone_id))
    let cloned_kudos = retreivedKudos.map((x, i, arr) => {
      if (i < (arr.length / 2)) return null
      return x.toNumber()
    });
    cloned_kudos = cloned_kudos.filter(k => k !== null)
    assert.deepEqual(cloned_kudos, [0, 0, 0, 0]);

    // Clone a new Kudos, make sure the kudos_id and totalSupply are correct
    await instance.clone(accounts[4], kudos_id, numClones, {"from": accounts[3], "value": web3.utils.toWei(priceFinney.toString(), 'finney')});
    new_clone_id = (await instance.getLatestId()).toNumber();
    newSupply = (await instance.totalSupply()).toNumber();
    // The id sould always increment, even if a kudos is burned
    assert.equal(new_clone_id, clone_id + 1);
    // The startSupply should be the same as the newSupply, since we burned one
    assert.equal(newSupply, startSupply);
  });

  it("should fail when trying to clone a kudos without enough ETH in msg.value", async () => {
    // Mint a new Gen0 Kudos
    let instance = await Kudos.deployed();
    await instance.mint(mintAddress, priceFinney, numClonesAllowed, tokenURI, {"from": accounts[0]});
    let kudos_id = (await instance.getLatestId()).toNumber();

    let numClones = 1;
    try {
      await instance.clone(accounts[1], kudos_id, numClones, {"from": accounts[1], "value": web3.utils.toWei((priceFinney - 1).toString(), 'finney')});
      assert.fail();
    } catch (err) {
      assert.ok(err);
    }
  });

  it("should fail when trying to make too many clones", async () => {
    // Mint a new Gen0 Kudos
    let instance = await Kudos.deployed();
    await instance.mint(mintAddress, priceFinney, numClonesAllowed, tokenURI, {"from": accounts[0]});
    let kudos_id = (await instance.getLatestId()).toNumber();

    let numClones = 100;
    try {
      await instance.clone(accounts[1], kudos_id, numClones, {"from": accounts[1], "value": web3.utils.toWei(priceFinney.toString(), 'finney')});
      assert.fail();
    } catch (err) {
      assert.ok(err);
    }
  });

  it("should not be able to clone a clone", async () => {
    // Mint a new Gen0 Kudos
    let instance = await Kudos.deployed();
    await instance.mint(mintAddress, priceFinney, numClonesAllowed, tokenURI, {"from": accounts[0]});
    let kudos_id = (await instance.getLatestId()).toNumber();

    let numClones = 1;
    await instance.clone(accounts[1], kudos_id, numClones, {"from": accounts[1], "value": web3.utils.toWei(priceFinney.toString(), 'finney')});
    let cloned_id = (await instance.getLatestId()).toNumber();
    try {
      await instance.clone(accounts[1], cloned_id, numClones, {"from": accounts[1], "value": web3.utils.toWei(priceFinney.toString(), 'finney')});
      assert.fail();
    } catch (err) {
      assert.ok(err);
    }
  })

  it("should be able to stop all minting and cloning on the contract", async () => {
    let instance = await Kudos.deployed();
    await instance.mint(mintAddress, priceFinney, numClonesAllowed, tokenURI, {"from": accounts[0]});
    let kudos_id = (await instance.getLatestId()).toNumber();
    let numClones = 1;
    // Make sure clonging works also
    await instance.clone(accounts[1], kudos_id, numClones, {"from": accounts[1], "value": priceWeiBN});
    // Turn minting off
    await instance.setMintable(false, {"from": accounts[0]});
    // Cloning should no longer work
    try {
      await instance.clone(accounts[1], kudos_id, numClones, {"from": accounts[1], "value": priceWeiBN});
      assert.fail();
    } catch (err) {
      assert.ok(err);
    }
    // Minting should no longer work
    try {
      await instance.mint(mintAddress, priceFinney, numClonesAllowed, tokenURI, {"from": accounts[0]});
      assert.fail();
    } catch (err) {
      assert.ok(err);
    }
  })

});
