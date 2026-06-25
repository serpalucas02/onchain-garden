// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script} from "forge-std/Script.sol";
import {OnChainGarden} from "../src/OnChainGarden.sol";

contract Deploy is Script {
    function run() external returns (OnChainGarden garden) {
        vm.startBroadcast();
        garden = new OnChainGarden();
        vm.stopBroadcast();
    }
}
