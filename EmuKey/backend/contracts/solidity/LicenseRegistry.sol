// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
contract LicenseRegistry is AccessControl {
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");
    bytes32 public constant DOMAIN_PLAN_V2 = keccak256("LICENSE_PLAN_COMMITMENT_V2");

    enum LicenseStatus { NONE, ACTIVE, SUSPENDED, REVOKED, EXPIRED }

    struct LicenseData {
        address provider;
        bytes16 productId;
        bytes16 planId;
        uint256 planVersion;
        bytes32 planCommitment;
        bytes32 activationCommitment;
        uint256 activationKeyVersion;
        uint256 maxActiveDevices;
        uint256 activeDevices;
        uint256 deviceStateVersion;
        uint256 expiresAt;
        LicenseStatus status;
    }

    mapping(bytes16 licenseId => LicenseData) private licenses;
    mapping(bytes16 commandId => bool) public processedCommands;
    event LicenseIssued(bytes16 indexed commandId, bytes16 indexed licenseId, address indexed provider, bytes32 planCommitment, bytes32 activationCommitment, uint256 activationKeyVersion, uint256 expiresAt);
    event LicenseRenewed(bytes16 indexed commandId, bytes16 indexed licenseId, uint256 expiresAt);
    event LicenseStatusChanged(bytes16 indexed commandId, bytes16 indexed licenseId, LicenseStatus status);
    event ActivationKeyRotated(bytes16 indexed commandId, bytes16 indexed licenseId, bytes32 activationCommitment, uint256 activationKeyVersion);
    event ActiveDeviceCountSynced(bytes16 indexed commandId, bytes16 indexed licenseId, uint256 activeDeviceCount, uint256 deviceStateVersion);

    error CommandAlreadyProcessed();
    error InvalidInput();
    error InvalidState();

    constructor(address admin, address relayer) {
        if (admin == address(0) || relayer == address(0)) revert InvalidInput();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(RELAYER_ROLE, relayer);
    }

    function computePlanCommitment(
        address provider,
        bytes16 productId,
        bytes16 planId,
        uint256 planVersion,
        uint256 durationMonths,
        uint256 maxActiveDevices,
        bytes32 entitlementsHash
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(
            DOMAIN_PLAN_V2,
            provider,
            productId,
            planId,
            planVersion,
            durationMonths,
            maxActiveDevices,
            entitlementsHash
        ));
    }

    function issueLicense(
        bytes16 commandId,
        bytes16 licenseId,
        address provider,
        bytes16 productId,
        bytes16 planId,
        uint256 planVersion,
        bytes32 planCommitment,
        bytes32 activationCommitment,
        uint256 activationKeyVersion,
        uint256 maxActiveDevices,
        uint256 expiresAt
    ) external onlyRole(RELAYER_ROLE) {
        _consume(commandId);
        if (
            licenseId == bytes16(0) || provider == address(0) ||
            planVersion == 0 || planCommitment == bytes32(0) || activationCommitment == bytes32(0) ||
            activationKeyVersion == 0 || maxActiveDevices == 0 || expiresAt <= block.timestamp
        ) revert InvalidInput();
        if (licenses[licenseId].status != LicenseStatus.NONE) revert InvalidState();
        licenses[licenseId] = LicenseData({
            provider: provider,
            productId: productId,
            planId: planId,
            planVersion: planVersion,
            planCommitment: planCommitment,
            activationCommitment: activationCommitment,
            activationKeyVersion: activationKeyVersion,
            maxActiveDevices: maxActiveDevices,
            activeDevices: 0,
            deviceStateVersion: 0,
            expiresAt: expiresAt,
            status: LicenseStatus.ACTIVE
        });
        emit LicenseIssued(commandId, licenseId, provider, planCommitment, activationCommitment, activationKeyVersion, expiresAt);
    }

    function renewLicense(bytes16 commandId, bytes16 licenseId, uint256 expiresAt)
        external onlyRole(RELAYER_ROLE)
    {
        _consume(commandId);
        LicenseData storage license = _existing(licenseId);
        if (license.status == LicenseStatus.REVOKED || expiresAt <= license.expiresAt) revert InvalidState();
        license.expiresAt = expiresAt;
        emit LicenseRenewed(commandId, licenseId, expiresAt);
    }

    function suspendLicense(bytes16 commandId, bytes16 licenseId)
        external onlyRole(RELAYER_ROLE)
    {
        _consume(commandId);
        LicenseData storage license = _existing(licenseId);
        if (license.status != LicenseStatus.ACTIVE || license.expiresAt <= block.timestamp) revert InvalidState();
        license.status = LicenseStatus.SUSPENDED;
        emit LicenseStatusChanged(commandId, licenseId, LicenseStatus.SUSPENDED);
    }

    function resumeLicense(bytes16 commandId, bytes16 licenseId)
        external onlyRole(RELAYER_ROLE)
    {
        _consume(commandId);
        LicenseData storage license = _existing(licenseId);
        if (license.status != LicenseStatus.SUSPENDED || license.expiresAt <= block.timestamp) revert InvalidState();
        license.status = LicenseStatus.ACTIVE;
        emit LicenseStatusChanged(commandId, licenseId, LicenseStatus.ACTIVE);
    }

    function revokeLicense(bytes16 commandId, bytes16 licenseId)
        external onlyRole(RELAYER_ROLE)
    {
        _consume(commandId);
        LicenseData storage license = _existing(licenseId);
        if (license.status == LicenseStatus.REVOKED) revert InvalidState();
        license.status = LicenseStatus.REVOKED;
        emit LicenseStatusChanged(commandId, licenseId, LicenseStatus.REVOKED);
    }

    function rotateActivationKey(
        bytes16 commandId,
        bytes16 licenseId,
        bytes32 newCommitment,
        uint256 newVersion
    ) external onlyRole(RELAYER_ROLE) {
        _consume(commandId);
        LicenseData storage license = _existing(licenseId);
        if (license.status == LicenseStatus.REVOKED || newCommitment == bytes32(0) || newVersion != license.activationKeyVersion + 1) revert InvalidState();
        license.activationCommitment = newCommitment;
        license.activationKeyVersion = newVersion;
        emit ActivationKeyRotated(commandId, licenseId, newCommitment, newVersion);
    }

    function syncActiveDeviceCount(
        bytes16 commandId,
        bytes16 licenseId,
        uint256 activeDeviceCount,
        uint256 deviceStateVersion
    ) external onlyRole(RELAYER_ROLE) {
        _consume(commandId);
        LicenseData storage license = _existing(licenseId);
        if (
            activeDeviceCount > license.maxActiveDevices ||
            deviceStateVersion <= license.deviceStateVersion
        ) revert InvalidState();
        license.activeDevices = activeDeviceCount;
        license.deviceStateVersion = deviceStateVersion;
        emit ActiveDeviceCountSynced(commandId, licenseId, activeDeviceCount, deviceStateVersion);
    }

    function getLicense(bytes16 licenseId) external view returns (LicenseData memory) {
        return _existing(licenseId);
    }

    function effectiveStatus(bytes16 licenseId) external view returns (LicenseStatus) {
        LicenseData storage license = _existing(licenseId);
        if (license.status == LicenseStatus.ACTIVE && license.expiresAt <= block.timestamp) {
            return LicenseStatus.EXPIRED;
        }
        return license.status;
    }

    function _consume(bytes16 commandId) private {
        if (commandId == bytes16(0)) revert InvalidInput();
        if (processedCommands[commandId]) revert CommandAlreadyProcessed();
        processedCommands[commandId] = true;
    }

    function _existing(bytes16 licenseId) private view returns (LicenseData storage license) {
        license = licenses[licenseId];
        if (license.status == LicenseStatus.NONE) revert InvalidState();
    }
}
