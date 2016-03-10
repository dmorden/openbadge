// Based on BluefruitLE by Don Coleman (https://github.com/don/cordova-plugin-ble-central/tree/master/examples/bluefruitle)

/* global mainPage, deviceList, refreshButton, statusText */
/* global detailPage, resultDiv, messageInput, sendButton, disconnectButton */
/* global ble  */
/* jshint browser: true , devel: true*/
'use strict';

// ASCII only
function bytesToString(buffer) {
    return String.fromCharCode.apply(null, new Uint8Array(buffer));
}

// ASCII only
function stringToBytes(string) {
    var array = new Uint8Array(string.length);
    for (var i = 0, l = string.length; i < l; i++) {
        array[i] = string.charCodeAt(i);
    }
    return array.buffer;
}

// this is Nordic's UART service
var bluefruit = {
    serviceUUID: '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
    txCharacteristic: '6e400002-b5a3-f393-e0a9-e50e24dcca9e', // transmit is from the phone's perspective
    rxCharacteristic: '6e400003-b5a3-f393-e0a9-e50e24dcca9e'  // receive is from the phone's perspective
};

var app = {
    initialize: function() {
        this.bindEvents();
        detailPage.hidden = true;
    },
    bindEvents: function() {
        document.addEventListener('deviceready', this.onDeviceReady, false);
        refreshButton.addEventListener('touchstart', this.refreshDeviceList, false);
        sendButton.addEventListener('click', this.sendData, false);
        disconnectButton.addEventListener('touchstart', this.disconnect, false);
        deviceList.addEventListener('touchstart', this.connect, false); // assume not scrolling
    },
    onDeviceReady: function() {
        app.showStatusText("Ready");
        app.refreshDeviceList();
    },
    refreshDeviceList: function() {
        app.showStatusText("Starting scan");
        deviceList.innerHTML = ''; // empties the list
        if (cordova.platformId === 'android') { // Android filtering is broken
            ble.scan([], 5, app.onDiscoverDevice, app.onError);
        } else {
            ble.scan([bluefruit.serviceUUID], 5, app.onDiscoverDevice, app.onError);
        }
        console.log('Start scan call end');
    },
    onDiscoverDevice: function(device) {
        var listItem = document.createElement('li'),
            html = '<b>' + device.name + '</b><br/>' +
                'RSSI: ' + device.rssi + '&nbsp;|&nbsp;' +
                device.id;

        listItem.dataset.deviceId = device.id;
        listItem.innerHTML = html;
        deviceList.appendChild(listItem);

        if (device.name == "BADGE") {
            app.showStatusText('Found: '+ device.id);
            app.connectToDevice(device.id);
        }
    },
    connectToDevice: function(deviceId) {
        app.showStatusText('Attemping to connect '+ deviceId);
        var onConnect = function(peripheral) {
                app.showStatusText('Connected '+ deviceId);
                //app.determineWriteType(peripheral);

                // subscribe for incoming data
                //ble.startNotification(deviceId, bluefruit.serviceUUID, bluefruit.rxCharacteristic, app.onData, app.onError);
                //sendButton.dataset.deviceId = deviceId;
                //disconnectButton.dataset.deviceId = deviceId;
                //resultDiv.innerHTML = "";
                //app.showDetailPage();
                app.disconnectFromDevice(deviceId);
            };

        ble.connect(deviceId, onConnect, app.onConnectError);
    },
    disconnectFromDevice: function(deviceId) {
        app.showStatusText('Disconnecting '+ deviceId);
        ble.disconnect(deviceId, app.onDisconnect, app.onError);
        app.showStatusText('Disconnect call ended '+ deviceId);
    },
    onDisconnect: function(e) {
        console.log('Disconnected '+ e);
        app.showStatusText('Disconnected '+ e);
    },


    connect: function(e) {
        app.showStatusText('Attemping to connect '+ e.target.dataset.deviceId);
        var deviceId = e.target.dataset.deviceId,
            onConnect = function(peripheral) {
                app.showStatusText('Connected '+ e.target.dataset.deviceId);
                app.determineWriteType(peripheral);

                // subscribe for incoming data
                ble.startNotification(deviceId, bluefruit.serviceUUID, bluefruit.rxCharacteristic, app.onData, app.onError);
                sendButton.dataset.deviceId = deviceId;
                disconnectButton.dataset.deviceId = deviceId;
                resultDiv.innerHTML = "";
                app.showDetailPage();
            };

        ble.connect(deviceId, onConnect, app.onConnectError);
    },
    determineWriteType: function(peripheral) {
        // Adafruit nRF8001 breakout uses WriteWithoutResponse for the TX characteristic
        // Newer Bluefruit devices use Write Request for the TX characteristic

        var characteristic = peripheral.characteristics.filter(function(element) {
            if (element.characteristic.toLowerCase() === bluefruit.txCharacteristic) {
                return element;
            }
        })[0];

        if (characteristic.properties.indexOf('WriteWithoutResponse') > -1) {
            app.writeWithoutResponse = true;
        } else {
            app.writeWithoutResponse = false;
        }

    },
    onData: function(data) { // data received from Arduino
        console.log(data);
        resultDiv.innerHTML = resultDiv.innerHTML + "Received: " + bytesToString(data) + "<br/>";
        resultDiv.scrollTop = resultDiv.scrollHeight;
    },
    sendData: function(event) { // send data to Arduino

        var success = function() {
            console.log("success");
            resultDiv.innerHTML = resultDiv.innerHTML + "Sent: " + messageInput.value + "<br/>";
            resultDiv.scrollTop = resultDiv.scrollHeight;
        };

        var failure = function() {
            alert("Failed writing data to the bluefruit le");
        };

        var data = stringToBytes(messageInput.value);
        var deviceId = event.target.dataset.deviceId;

        if (app.writeWithoutResponse) {
            ble.writeWithoutResponse(
                deviceId,
                bluefruit.serviceUUID,
                bluefruit.txCharacteristic,
                data, success, failure
            );
        } else {
            ble.write(
                deviceId,
                bluefruit.serviceUUID,
                bluefruit.txCharacteristic,
                data, success, failure
            );
        }

    },
    disconnect: function(event) {
        app.showStatusText('Disconnecting '+ event.target.dataset.deviceId);
        var deviceId = event.target.dataset.deviceId;
        ble.disconnect(deviceId, app.showMainPage, app.onError);
        app.showStatusText('Disconnect call ended '+ event.target.dataset.deviceId);
    },
    showMainPage: function() {
        mainPage.hidden = false;
        detailPage.hidden = true;
    },
    showDetailPage: function() {
        mainPage.hidden = true;
        detailPage.hidden = false;
    },
    onConnectError: function(reason) {
        console.log('Error connecting'+ reason);
        app.showStatusText('could not connect because'+ reason);
        //alert("ERROR Connecting: " + reason); // real apps should use notification.alert
    },

    onError: function(reason) {
        console.log('Error '+ reason);
        //alert("ERROR: " + reason); // real apps should use notification.alert
    },

    showStatusText: function(info) {
        console.log(info);
        document.getElementById("statusText").innerHTML = info;
    }
};
