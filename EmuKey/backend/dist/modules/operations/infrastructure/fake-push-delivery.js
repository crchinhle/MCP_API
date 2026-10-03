export class FakePushDelivery {
    deliver(input) {
        return Promise.resolve({
            providerMessageId: `fake-push-${input.eventKey}`,
        });
    }
}
//# sourceMappingURL=fake-push-delivery.js.map