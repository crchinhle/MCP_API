# Route inventory

Nguồn: cây JSX trong App.tsx và query navigation trong RoleShell.tsx, chế độ trong authCopy của AuthScreen và tab tích hợp ProviderOperationsScreen. Danh sách được sinh từ source, sau đó đối chiếu điều hướng browser. Route con dùng role của ProtectedRoute cha.

| Role | Route | Màn hình | Nguồn |
| --- | --- | --- | --- |
| GUEST | `/` | PublicHomeScreen | App.tsx |
| GUEST | `/auth` | AuthScreen | App.tsx |
| GUEST | `/products` | CatalogScreen | App.tsx |
| GUEST | `/catalog` | CatalogScreen | App.tsx |
| GUEST | `/compare` | ComparePlansScreen | App.tsx |
| GUEST | `/products/id/:productId` | ProductDetailScreen | App.tsx |
| GUEST | `/products/:slug` | ProductDetailScreen | App.tsx |
| GUEST | `/verify` | PublicVerificationScreen | App.tsx |
| GUEST | `/help` | PublicHelpScreen | App.tsx |
| CUSTOMER | `/buyer` | BuyerHomeScreen | App.tsx |
| CUSTOMER | `/buyer/products` | CatalogScreen | App.tsx |
| CUSTOMER | `/buyer/products/id/:productId` | ProductDetailScreen | App.tsx |
| CUSTOMER | `/buyer/products/:slug` | ProductDetailScreen | App.tsx |
| CUSTOMER | `/buyer/checkout` | BuyerCheckoutScreen | App.tsx |
| CUSTOMER | `/buyer/orders/:id/payment` | PaymentStatusScreen | App.tsx |
| CUSTOMER | `/buyer/orders` | BuyerOrdersScreen | App.tsx |
| CUSTOMER | `/buyer/licenses` | BuyerLicenseHubScreen | App.tsx |
| CUSTOMER | `/buyer/licenses/:licenseId/renew` | BuyerRenewalScreen | App.tsx |
| CUSTOMER | `/buyer/support` | BuyerAssistanceScreen | App.tsx |
| CUSTOMER | `/buyer/profile` | AccountProfileScreen | App.tsx |
| PROVIDER_ADMIN | `/provider` | ProviderDashboardScreen | App.tsx |
| PROVIDER_ADMIN | `/provider/catalog` | ProviderCatalogScreen | App.tsx |
| PROVIDER_ADMIN | `/provider/licenses` | ProviderLicensesScreen | App.tsx |
| PROVIDER_ADMIN | `/provider/profile` | AccountProfileScreen | App.tsx |
| PROVIDER_ADMIN | `/provider/knowledge` | AiKnowledgeScreen | App.tsx |
| PROVIDER_ADMIN | `/provider/operations` | ProviderOperationsScreen | App.tsx |
| SUPPORT_STAFF | `/support` | SupportConsoleScreen | App.tsx |
| SUPPORT_STAFF | `/support/profile` | AccountProfileScreen | App.tsx |
| SYSTEM_ADMIN | `/system/console` | SystemConsoleScreen | App.tsx |
| SYSTEM_ADMIN | `/system/console/knowledge` | AiKnowledgeScreen | App.tsx |
| SYSTEM_ADMIN | `/system/console/profile` | AccountProfileScreen | App.tsx |
| GUEST | `/__ui-audit-not-found__` | NotFoundPage | App.tsx |
| SUPPORT_STAFF | `/support?view=active` | SupportConsoleScreen | RoleShell.tsx |
| SUPPORT_STAFF | `/support?view=resolved` | SupportConsoleScreen | RoleShell.tsx |
| SYSTEM_ADMIN | `/system/console?view=users` | SystemConsoleScreen | RoleShell.tsx |
| SYSTEM_ADMIN | `/system/console?view=payments` | SystemConsoleScreen | RoleShell.tsx |
| SYSTEM_ADMIN | `/system/console?view=blockchain` | SystemConsoleScreen | RoleShell.tsx |
| GUEST | `/auth?mode=provider-invite` | AuthScreen | AuthScreen.tsx |
| GUEST | `/auth?mode=forgot` | AuthScreen | AuthScreen.tsx |
| GUEST | `/auth?mode=licensing-action` | AuthScreen | AuthScreen.tsx |
| GUEST | `/auth?mode=register` | AuthScreen | AuthScreen.tsx |
| GUEST | `/auth?mode=reset` | AuthScreen | AuthScreen.tsx |
| GUEST | `/auth?mode=verify` | AuthScreen | AuthScreen.tsx |
| PROVIDER_ADMIN | `/provider/operations?tab=integration` | ProviderOperationsScreen | ProviderOperationsScreen.tsx |

## Trạng thái tương tác cần theo dõi riêng

- Auth: login, register, forgot, reset, provider invitation, validation, bootstrap/session error.
- Catalog: normal, search/no results, sort, page, loading, server error/retry, broken image; compare selected/empty.
- Buyer: purchase modal, order drawer, cancel/terms, payment pending/review/complete, license detail/recovery/handoff, renewal, support and profile.
- Provider: product/plan forms, dirty close, publish conflict, license drawer/filter, integration config, knowledge upload/details.
- Support: queue preview, active/resolved, claim expiry, delivery panel; system: users/invitations/payment review/blockchain/knowledge.
- Shared: mobile menu, account dropdown, notifications, AI launcher, 403/404 and error boundary.

Các trạng thái chưa chạy không tự kế thừa CAPTURED hoặc VERIFIED từ route normal.
