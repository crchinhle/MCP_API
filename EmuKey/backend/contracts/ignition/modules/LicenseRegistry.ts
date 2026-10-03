import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

export default buildModule('LicenseRegistryModule', (module) => {
  const admin = module.getAccount(0);
  const registry = module.contract('LicenseRegistry', [admin, admin]);

  return { registry };
});
