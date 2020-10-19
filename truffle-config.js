const fs = require('fs')
const HDWalletProvider = require('@truffle/hdwallet-provider')

// First read in the secrets.json to get our mnemonic
let secrets
let mnemonic
let privkeys

if (fs.existsSync('secrets.json')) {
  secrets = JSON.parse(fs.readFileSync('secrets.json', 'utf8'))
  mnemonic = secrets.mnemonic
  token = secrets.token
  privkeys = secrets.privKeys
} else {
  console.log('No secrets.json found. If you are trying to publish EPM ' +
              'this will fail. Otherwise, you can ignore this message!')
  mnemonic = ''
  token = ''
  privkeys = []
}

module.exports = {
  // See <http://truffleframework.com/docs/advanced/configuration>
  // to customize your Truffle configuration!
  networks: {
    development: {
      port: 7545,
      network_id: '*',
      host: '127.0.0.1'
    },

    xdai: {
      provider: function() {
            return new HDWalletProvider(
           privkeys,
           "https://dai.poa.network")
      },
      network_id: 100,
      from: '0x6239ff1040e412491557a7a02b2cbcc5ae85dc8f',
      gasPrice: 1000000000
    },

    live: {
      provider: function() {
        return new HDWalletProviderPriv(privkeys, 'https://mainnet.infura.io/' + token)
      },
      network_id: 1, // Ethereum public network
      from: '0x6239ff1040e412491557a7a02b2cbcc5ae85dc8f',
      // Needed to set the gasPrice and Nonce in the console for this to work
      // var contract = Kudos.new({gasPrice:5000000000, nonce: 64})
      gasPrice: 5000000000,
      // nonce: 64
      // gas: 5612388,
      // gas: 4612388
      // optional config values
      // host - defaults to "localhost"
      // port - defaults to 8545
      // gas
      // gasPrice
      // from - default address to use for any transaction Truffle makes during migrations
    },
    ropsten: {
      provider: function() {
        return new HDWalletProvider(mnemonic, 'https://ropsten.infura.io/' + token)
      },
      network_id: 3,
      from: '0xd386793f1db5f21609571c0164841e5ea2d33ad8',
      // gas: 5612388
      // gas: 4612388
    },
    rinkeby: {
      provider: function() {
        return new HDWalletProviderPriv(privkeys, 'https://rinkeby.infura.io/' + token)
      },
      network_id: 4,
      from: '0x6239ff1040e412491557a7a02b2cbcc5ae85dc8f',
    },
  },

  compilers: {
    solc: {
      version: "0.6.11"
    }
  }
};
