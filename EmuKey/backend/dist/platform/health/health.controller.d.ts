import { LivenessDto, ReadinessDto } from './health.dto.js';
import { PlatformReadinessService } from './platform-readiness.service.js';
export declare class HealthController {
    private readonly readiness;
    constructor(readiness: PlatformReadinessService);
    live(): LivenessDto;
    ready(): Promise<ReadinessDto>;
}
