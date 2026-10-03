export class FakeAiGateway {
    answerGrounded(input) {
        if (input.sources.length === 0) {
            return Promise.resolve({
                answer: 'Không đủ nguồn để trả lời.',
                citedSourceIds: [],
                grounded: false,
            });
        }
        return Promise.resolve({
            answer: `Câu trả lời giả lập cho: ${input.question}`,
            citedSourceIds: input.sources.map((source) => source.id),
            grounded: true,
        });
    }
}
//# sourceMappingURL=fake-ai.gateway.js.map