/**
 * @fileOverview PocketActionCtrl angular controller
 */
'use strict';

define(['./module', 'darkwallet'], function (controllers, DarkWallet) {
  controllers.controller('PocketActionCtrl', ['$scope', 'modals', function($scope, modals) {

    /**
     * Delete pocket
     */
    $scope.deletePocket = function(pocket) {
        modals.open('confirm-delete', {name: pocket.name, object: pocket}, $scope.deletePocketFinish)
    };

    /**
     * Rename a pocket
     */
    $scope.renamePocket = function(pocket) {
        // continues in PocketCreateCtrl
        $scope.forms.pocketLabelForm.$show();
    };

    /**
     * Really delete a pocket after confirmation
     */
    $scope.deletePocketFinish = function(pocket) {
        var identity = DarkWallet.getIdentity();
        identity.wallet.pockets.deletePocket(pocket.name);
        $scope.selectPocket();
    };

    /**
     * Toggle the pocket's mixing state
     */
    $scope.setMixing = function(pocket) {
        var identity = DarkWallet.getIdentity();
        var walletPocket = identity.wallet.pockets.getPocket(pocket.name);
        walletPocket.mixing = !walletPocket.mixing;
        pocket.mixing = walletPocket.mixing;
        identity.wallet.store.save();
        var mixerService = DarkWallet.service.mixer;
        mixerService.checkMixing();
    };

    /**
     * Move funds to another pocket or identity
     */
    $scope.moveFunds = function(type, index) {
        var wallet = DarkWallet.getIdentity().wallet;
        var walletService = DarkWallet.service.wallet;
        var to;
        var address;
        if (type === 'pocket') {
            to = wallet.pockets.hdPockets[index].name;
            address = wallet.getFreeAddress(index).address;
        } else if (type === 'multisig') {
            to = wallet.multisig.funds[index].name;
            address = wallet.getFreeAddress(index).address;
        } else {
            to = $scope.availableIdentities[index];
            address = '';
        }
        var message = "Are you sure you want to move all ";
        message += $scope.pocket.name + " funds to " + to + "?"
        modals.password(message, function(password) {
            var fee = wallet.store.get('fee');
            var amount = wallet.getBalance($scope.pocket.index).confirmed - fee;
            walletService.send($scope.pocket.index, [{amount: amount, address: address}], null, fee, true, function() {
                console.log('Not implemented yet.');
            });
        });
    };

}]);
});
