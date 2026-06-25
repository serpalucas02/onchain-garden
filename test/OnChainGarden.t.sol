// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {OnChainGarden} from "../src/OnChainGarden.sol";
import {ERC721Holder} from "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import {IERC721Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";

contract OnChainGardenTest is Test {
    OnChainGarden garden;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    event Planted(address indexed owner, uint256 indexed tokenId);
    event Watered(uint256 indexed tokenId, uint64 waterCount);

    function setUp() public {
        garden = new OnChainGarden();
    }

    function _mintTo(address who) internal returns (uint256 id) {
        vm.prank(who);
        id = garden.mint();
    }

    function _water(address owner, uint256 id, uint256 times) internal {
        for (uint256 i; i < times; i++) {
            vm.prank(owner);
            garden.water(id);
        }
    }

    // --- mint ---

    function testMintBasics() public {
        uint256 id = _mintTo(alice);
        assertEq(id, 1, "first id should be 1");
        assertEq(garden.ownerOf(id), alice, "owner should be alice");
        assertEq(garden.balanceOf(alice), 1, "balance should be 1");
        assertEq(garden.stageOf(id), 0, "fresh plant is a seed");
        assertFalse(garden.isThirsty(id), "fresh plant is not thirsty");
    }

    function testMintIncrementsIds() public {
        assertEq(_mintTo(alice), 1);
        assertEq(_mintTo(bob), 2);
    }

    function testMintEmitsPlanted() public {
        vm.expectEmit(true, true, false, true, address(garden));
        emit Planted(alice, 1);
        vm.prank(alice);
        garden.mint();
    }

    function testMintToContractReceiverWorks() public {
        GoodReceiver receiver = new GoodReceiver();
        receiver.plant(garden);
        assertEq(garden.balanceOf(address(receiver)), 1);
    }

    function testMintRevertsForNonReceiverContract() public {
        BadReceiver receiver = new BadReceiver();
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721InvalidReceiver.selector, address(receiver)));
        receiver.plant(garden);
    }

    // --- growth (water + stages) ---

    function testStageProgressionBoundaries() public {
        uint256 id = _mintTo(alice);
        assertEq(garden.stageOf(id), 0); // 0 waters

        _water(alice, id, 2);
        assertEq(garden.stageOf(id), 0); // 2 -> still seed
        _water(alice, id, 1);
        assertEq(garden.stageOf(id), 1); // 3 -> sprout
        _water(alice, id, 2);
        assertEq(garden.stageOf(id), 1); // 5 -> still sprout
        _water(alice, id, 1);
        assertEq(garden.stageOf(id), 2); // 6 -> plant
        _water(alice, id, 3);
        assertEq(garden.stageOf(id), 2); // 9 -> still plant
        _water(alice, id, 1);
        assertEq(garden.stageOf(id), 3); // 10 -> bloom
        _water(alice, id, 5);
        assertEq(garden.stageOf(id), 3); // 15 -> caps at bloom
    }

    function testWaterEmitsWatered() public {
        uint256 id = _mintTo(alice);
        vm.expectEmit(true, false, false, true, address(garden));
        emit Watered(id, 1);
        vm.prank(alice);
        garden.water(id);
    }

    function testFuzzGrowthMatchesThresholds(uint8 waters) public {
        uint256 id = _mintTo(alice);
        waters = uint8(bound(waters, 0, 30));
        _water(alice, id, waters);

        uint8 stage = garden.stageOf(id);
        if (waters >= 10) assertEq(stage, 3);
        else if (waters >= 6) assertEq(stage, 2);
        else if (waters >= 3) assertEq(stage, 1);
        else assertEq(stage, 0);
    }

    // --- access control (the "try to break it" part) ---

    function testWaterRevertsIfNotOwner() public {
        uint256 id = _mintTo(alice);
        vm.prank(bob);
        vm.expectRevert(OnChainGarden.NotYourPlant.selector);
        garden.water(id);
    }

    function testWaterRevertsForNonexistentPlant() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721NonexistentToken.selector, 999));
        garden.water(999);
    }

    function testWateringRightsFollowOwnership() public {
        uint256 id = _mintTo(alice);

        vm.prank(alice);
        garden.transferFrom(alice, bob, id);
        assertEq(garden.ownerOf(id), bob);

        // old owner can no longer water it
        vm.prank(alice);
        vm.expectRevert(OnChainGarden.NotYourPlant.selector);
        garden.water(id);

        // new owner can
        vm.prank(bob);
        garden.water(id);
    }

    // --- thirst (time-based state) ---

    function testThirstyAfterNeglect() public {
        uint256 id = _mintTo(alice);
        vm.warp(block.timestamp + garden.THIRSTY_AFTER() + 1);
        assertTrue(garden.isThirsty(id));
    }

    function testNotThirstyExactlyAtThreshold() public {
        uint256 id = _mintTo(alice);
        uint256 t = block.timestamp;

        vm.warp(t + garden.THIRSTY_AFTER());
        assertFalse(garden.isThirsty(id), "strictly greater than, so not yet");

        vm.warp(t + garden.THIRSTY_AFTER() + 1);
        assertTrue(garden.isThirsty(id));
    }

    function testWateringRevivesThirstyPlant() public {
        uint256 id = _mintTo(alice);
        vm.warp(block.timestamp + garden.THIRSTY_AFTER() + 1);
        assertTrue(garden.isThirsty(id));

        vm.prank(alice);
        garden.water(id);
        assertFalse(garden.isThirsty(id), "watering revives it");
    }

    // --- tokenURI (on-chain metadata, and that it's truly dynamic) ---

    function testTokenURIRevertsForNonexistent() public {
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721NonexistentToken.selector, 999));
        garden.tokenURI(999);
    }

    function testTokenURIHasJsonPrefix() public {
        uint256 id = _mintTo(alice);
        assertTrue(_startsWith(garden.tokenURI(id), "data:application/json;base64,"));
    }

    function testTokenURIChangesWhenWatered() public {
        uint256 id = _mintTo(alice);
        string memory before = garden.tokenURI(id);
        _water(alice, id, 3); // seed -> sprout
        assertTrue(_differs(before, garden.tokenURI(id)), "art should change with growth");
    }

    function testTokenURIChangesWhenThirsty() public {
        uint256 id = _mintTo(alice);
        string memory healthy = garden.tokenURI(id);
        vm.warp(block.timestamp + garden.THIRSTY_AFTER() + 1);
        assertTrue(_differs(healthy, garden.tokenURI(id)), "art should change when thirsty");
    }

    /// @dev Walks every stage so all SVG branches get rendered (coverage of _body/_svg).
    function testTokenURIRendersEveryStage() public {
        uint256 id = _mintTo(alice);
        assertGt(bytes(garden.tokenURI(id)).length, 0); // seed
        _water(alice, id, 3);
        assertGt(bytes(garden.tokenURI(id)).length, 0); // sprout
        _water(alice, id, 3);
        assertGt(bytes(garden.tokenURI(id)).length, 0); // plant
        _water(alice, id, 4);
        assertGt(bytes(garden.tokenURI(id)).length, 0); // bloom
        vm.warp(block.timestamp + garden.THIRSTY_AFTER() + 1);
        assertGt(bytes(garden.tokenURI(id)).length, 0); // bloom + thirsty
    }

    // --- uniqueness (the per-plant seed) ---

    function testSeedIsStableAcrossWatering() public {
        uint256 id = _mintTo(alice);
        uint64 s = garden.seedOf(id);
        _water(alice, id, 7);
        assertEq(garden.seedOf(id), s, "a plant's seed (its look) must never change");
    }

    function testPlantsLookDifferent() public {
        uint64 seedA = garden.seedOf(_mintTo(alice));
        uint64 seedB = garden.seedOf(_mintTo(bob));
        assertTrue(seedA != seedB, "different plants get different seeds");
        assertTrue(
            _differs(garden.previewArt(seedA, 3, false), garden.previewArt(seedB, 3, false)),
            "different seeds should render different art"
        );
    }

    /// @dev Drives crafted seeds through previewArt so every palette/shape branch renders.
    function testEveryArtBranchRenders() public view {
        // byte 0 -> green shade (drawn from the sprout stage up)
        for (uint64 i; i < 6; i++) assertGt(bytes(garden.previewArt(i, 2, false)).length, 0);
        // byte 1 -> sky shade
        for (uint64 i; i < 6; i++) assertGt(bytes(garden.previewArt(i << 8, 0, false)).length, 0);
        // byte 2 -> flower color (bloom only)
        for (uint64 i; i < 6; i++) assertGt(bytes(garden.previewArt(i << 16, 3, false)).length, 0);
        // byte 3 -> pot color
        for (uint64 i; i < 5; i++) assertGt(bytes(garden.previewArt(i << 24, 0, false)).length, 0);
        // byte 4 -> petal count 4/5/6 (bloom only)
        for (uint64 i; i < 3; i++) assertGt(bytes(garden.previewArt(i << 32, 3, false)).length, 0);
        // byte 5 -> pot shape tapered/rounded/square
        for (uint64 i; i < 3; i++) assertGt(bytes(garden.previewArt(i << 40, 0, false)).length, 0);
        // remaining body/svg branches: sprout, and the thirsty (wilted) variant
        assertGt(bytes(garden.previewArt(0, 1, false)).length, 0);
        assertGt(bytes(garden.previewArt(0, 3, true)).length, 0);
    }

    // --- helpers ---

    function _differs(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(bytes(a)) != keccak256(bytes(b));
    }

    function _startsWith(string memory s, string memory prefix) internal pure returns (bool) {
        bytes memory sb = bytes(s);
        bytes memory pb = bytes(prefix);
        if (sb.length < pb.length) return false;
        for (uint256 i; i < pb.length; i++) {
            if (sb[i] != pb[i]) return false;
        }
        return true;
    }
}

contract GoodReceiver is ERC721Holder {
    function plant(OnChainGarden g) external {
        g.mint();
    }
}

contract BadReceiver {
    function plant(OnChainGarden g) external {
        g.mint();
    }
}
