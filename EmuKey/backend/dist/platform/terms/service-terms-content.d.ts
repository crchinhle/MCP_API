export interface ServiceTermsArtifact {
    content: string;
    hash: string;
    version: string;
}
/** Platform-wide legal content. Orders snapshot its content identity on creation. */
export declare class ServiceTermsContent {
    private readonly path;
    private readonly version;
    constructor(path?: string);
    loadServiceTerms(): Promise<string>;
    loadServiceTermsArtifact(): Promise<ServiceTermsArtifact>;
}
