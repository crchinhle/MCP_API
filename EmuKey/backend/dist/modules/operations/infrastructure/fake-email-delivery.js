export class FakeEmailDelivery {
    deliver(input) {
        return Promise.resolve({
            providerMessageId: `fake-email-${input.eventKey}`,
        });
    }
}
//# sourceMappingURL=fake-email-delivery.js.map