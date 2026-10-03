export declare class CreateKnowledgeDocumentDto {
    productId: string;
    logicalDocumentKey: string;
    sourceType: 'FAQ' | 'PDF' | 'TXT';
    title: string;
    chunks?: string[];
    version?: number;
}
export declare class KnowledgeDocumentDto {
    id: string;
    title: string;
    logicalDocumentKey: string;
    version: number;
    status: string;
    isCurrent: boolean;
}
export declare class PublishKnowledgeDocumentDto {
    expectedCurrentVersion?: number;
}
export declare class KnowledgeDocumentDetailDto extends KnowledgeDocumentDto {
    chunks: string[];
}
export declare class KnowledgeQueryDto {
    question: string;
}
export declare class KnowledgeSourceDto {
    id: string;
    content: string;
}
