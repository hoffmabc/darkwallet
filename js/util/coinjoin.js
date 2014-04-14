define(['bitcoinjs-lib'], function(Bitcoin) {
  'use strict';

  /*
   * CoinJoin Clas
   * @constructor
   */
  function CoinJoin(core, role, state, tx, myAmount, fee) {
    this.core = core;
    this.state = state;
    this.role = role;
    this.myTx = tx;
    this.myAmount = myAmount;
    this.fee = fee;
  }
  /*
   * CoinJoin State machine once paired
   * 1st message guest -> [initiator]
   */
  CoinJoin.prototype.fullfill = function(peer, msg) {
      this.peer = peer;
      // Check there is one output like we want to join
      var amount = this.myAmount;
      var remoteTx = new Bitcoin.Transaction(msg.tx);
      var isOk = false;
      remoteTx.outs.forEach(function(anOut) {
          if (anOut.value == amount) {
              isOk = true;
          }
      })
      if (!isOk) {
          console.log("no output found with the right value");
          return;
      }
      // Now check there are inputs with enough funds
      isOk = false;

      // Now add our inputs and outputs after the ones from guest
      var myTx = this.myTx;
      myTx.ins.forEach(function(anIn) {
          remoteTx.addInput(anIn.clone());
      });
      myTx.outs.forEach(function(anOut) {
          remoteTx.addOutput(anOut.clone());
      });

      // Save tx
      this.tx = remoteTx;
      this.state = 'fullfilled';
      return remoteTx;
  }

  /*
   * 1st message initiator -> [guest]
   */
  CoinJoin.prototype.sign = function(peer, msg) {
      var remoteTx = new Bitcoin.Transaction(msg.tx);

      // Check the original inputs and outputs are there
      this.checkMyInputsOutputs(this.myTx, remoteTx);

      // Now sign our input(s) against the outputs
      this.signMyInputs(remoteTx, this.myTx);

      // Save tx
      this.tx = remoteTx;
      this.state = 'signed';
      return remoteTx;
  }

  /*
   * 2nd message guest -> [initiator]
   */
  CoinJoin.prototype.finishInitiator = function(peer, msg) {
      var myTx = this.tx;
      var remoteTx = new Bitcoin.Transaction(msg.tx);

      // Check no new inputs or outputs where added
      this.checkInputsOutputs(myTx, remoteTx);

      // Check the guest signed

      // Now sign our input(s) against the outputs
      this.signMyInputs(remoteTx, this.myTx);
      
      // We are done here...

      // Save tx
      this.tx = remoteTx;
      this.state = 'finished';
      return remoteTx;
  }

  /*
   * 2nd message initiator -> [guest]
   */
  CoinJoin.prototype.finishGuest = function(peer, msg) {
      var myTx = this.tx;
      var remoteTx = new Bitcoin.Transaction(msg.tx);

      // Check no new inputs or outputs where added
      this.checkInputsOutputs(myTx, remoteTx);

      // Check our signatures are there

      // Check the inititator signed
      var remoteTx = new Bitcoin.Transaction(msg.tx);

      // We are done here...

      // Save tx
      this.state = 'finished';
      this.tx = remoteTx;
      return remoteTx;
  }

  /*
   * Process a message for an ongoing CoinJoin
   */
  CoinJoin.prototype.process = function(peer, msg) {
      var txHex = msg.tx;

      switch (this.state) {
          case 'announce':
              // 1. If initiator, comes with new input and outputs from guest
              return this.fullfill();
          case 'accepted':
              // 2. If guest, comes with full tx, check and sign
              return this.sign();
          case 'fullfilled':
              // 3. Initiator finally signs his part
              return this.finishInitiator();
          case 'signed':
              // 3. Initiator finally signs his part
              return this.finishGuest();
      }
  }

  CoinJoin.prototype.cancel = function() {
      if (this.role == 'initiator') {
          // Back to announce state
          this.state = 'announce';
      }
      else if (this.role == 'guest') {
          this.state = 'cancelled';
      }
  }

  /*
   * Process a message finishing a coinjoin conversation
   */
  CoinJoin.prototype.kill = function(msg) {
     console.log("Finished CoinJoin", msg.id)

     switch(this.state) {
         case 'accepted':
         case 'fullfilled':
         case 'signed':
             this.cancel();
             break;
         case 'finished':
         case 'announce':
         default:
             // do nothing
             break;
     }

  }

  /*
   * Helper functions
   */
  CoinJoin.prototype.signMyInputs = function(myTx, newTx) {
      var identity = this.core.getCurrentIdentity();
      for(var i=0; i<newTx.ins; i++) {
          var anIn = newTx.ins[i];
          if (identity.txdb.transactions.hasOwnProperty(anIn.outpoint.hash)) {
              var prevTxHex = identity.txdb.transactions[anIn.outpoint.hash];
              var prevTx = new Bitcoin.Transaction(prevTxHex);
              var output = prevTx.out[anIn.outpoint.index];
              var walletAddress = identity.wallet.getWalletAddress(output.address);

              var found = myTx.ins.filter(function(myIn, i) {
                  return (myIn.hash == newIn.hash) && (myIn.index == newIn.index);
              });
              if (found.length == 1) {
                  identity.wallet.getPrivateKey(walletAddress.index, password, function(privKey) {
                      newTx.sign(i, privKey);
                  });
              }
          } else {
              console.log("No wallet address for one of our addresses!");
          }
      }
  }

  CoinJoin.prototype.checkInputsOutputs = function(origTx, newTx) {
      var isValid = true;
      if (origTx.ins.length != newTx.ins.length) return false;
      if (origTx.outs.length != newTx.outs.length) return false;

      isValid = this.checkMyInputsOutputs(origTx, newTx);

      return isValid;
  }

  CoinJoin.prototype.checkMyInputsOutputs = function(origTx, newTx) {
      for(var i=0; i<origTx.ins.length; i++) {
          // TODO: should check the scripts too
          var origIn = origTx.ins[i];
          var found = newTx.ins.filter(function(newIn) {
              return (origIn.hash == newIn.hash) && (origIn.index == newIn.index);
          });
          if (found.length != 1) return false;
      }
      for(var i=0; i<origTx.outs.length; i++) {
          var origOut = origTx.outs[i];
          var found = newTx.outs.filter(function(newOut) {
             return (origOut.address != newOut.address) && (origOut.value != newOut.value) ;
          });
          if (found.length != 1) return false;
      }
      return true;
  }


  return CoinJoin;

});