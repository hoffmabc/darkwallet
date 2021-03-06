/**
 * @fileOverview WalletCtrl angular controller
 */
'use strict';

define(['./module', 'darkwallet', 'frontend/port'],
function (controllers, DarkWallet, Port) {
  'use strict';

  /**
   * Controller
   */
  controllers.controller('WalletCtrl',
  ['$scope', '$location', 'clipboard', 'modals', '$wallet',
      function($scope, $location, clipboard, modals, $wallet) {

  // Scope variables
  $scope.rates = {};
  $scope.allAddresses = [];
  $scope.totalBalance = 0;
  $scope.forms = {};
  $scope.identityName = false;


  // Global scope utils
  $scope.modals = modals;
  $scope.clipboard = clipboard;


  /**
   * Wallet Port
   * Sends notifications about wallet state and identity change
   */
  Port.connectNg('wallet', $scope, function(data) {
      if (data.type == 'ready') {
          var updated = identityLoaded(DarkWallet.getIdentity());
          if(updated && !$scope.$$phase) {
              $scope.$apply();
          }
      }
      else if (data.type == 'height') {
          $scope.currentHeight = data.value;
      }
      else if (data.type == 'ticker') {
          $scope.rates[data.currency] = data.rate;
      }
  });


  /**
   * Check if a route is active
   */
  $scope.isActive = function(route) {
    return route === $location.path();
  };


  /**
   * Link given identity to the scope
   */
  function linkIdentity(identity) {
      // Link address arrays
      $scope.addresses = $wallet.addresses;
      $scope.allAddresses = $wallet.allAddresses;

      // Link pockets and funds
      $scope.hdPockets = identity.wallet.pockets.hdPockets;
      $scope.allFunds = identity.wallet.multisig.funds;

      // set some links
      $scope.availableIdentities = DarkWallet.getKeyRing().availableIdentities;

      // get the balance for the wallet
      var balance = $wallet.getBalance();
      
      $scope.totalBalance = balance.confirmed;
      $scope.totalUnconfirmed = balance.unconfirmed;
      $scope.selectedCurrency = identity.settings.currency;
      $scope.selectedFiat = identity.settings.fiatCurrency;
      $scope.defaultFee = identity.wallet.fee / 100000000;

      $scope.identityName = identity.name;
  }


  /**
   * Identity loaded, called when a new identity is loaded
   */
  function identityLoaded(identity) {
      if (!identity || $scope.identityName == identity.name) {
          return false;
      }

      if (identity.reseed) {
          $scope.alert = 'reseed';
      }

      // Inform the wallet service
      $wallet.onIdentityLoaded(identity);

      // Link some variables from the identity to scope
      linkIdentity(identity);

      // this will connect to obelisk if we're not yet connected
      if (DarkWallet.getClient() && DarkWallet.getClient().connected) {
          // Already connected, set height
          $scope.currentHeight = DarkWallet.service.wallet.currentHeight;
      } else {
          // Request connecting to blockchain
          setTimeout(function() {
            DarkWallet.core.connect();
          });
      }
      console.log("[WalletCtrl] loadIdentity", identity.name);
      // apply scope changes
      return true;
  };


  // Load identity
  // If the identity is not immediately loaded then the callback will
  // not be called  and we get it on the Port.
  $wallet.loadIdentity(identityLoaded);

}]);
});
