import type { Request, Response } from 'express';
import { ChangePasswordDto, CredentialsDto, EmailDto, ProfileDto, RegisterDto, ResetPasswordDto, StateDto, TokenDto } from './identity.dto.js';
import { IdentityService } from './identity.service.js';
import type { AuthPrincipal } from './identity.types.js';
export declare class IdentityController {
    private readonly service;
    private readonly cookieOptions;
    constructor(service: IdentityService);
    register(dto: RegisterDto): Promise<{
        accepted: boolean;
    }>;
    verifyEmail(dto: TokenDto): Promise<void>;
    resendVerification(dto: EmailDto): Promise<{
        accepted: boolean;
    }>;
    private setRefresh;
    private refreshCookie;
    forgot(dto: EmailDto): Promise<{
        accepted: boolean;
    }>;
    reset(dto: ResetPasswordDto): Promise<void>;
    login(dto: CredentialsDto, response: Response): Promise<{
        accessToken: string;
        user: {
            address: string | null;
            customerType: "INDIVIDUAL" | "STUDENT" | "BUSINESS" | null;
            displayName: string;
            email: string;
            emailVerifiedAt: Date | null;
            id: string;
            organizationName: string | null;
            phone: string | null;
            role: "SYSTEM_ADMIN" | "PROVIDER_ADMIN" | "CUSTOMER" | "SUPPORT_STAFF";
            sessionVersion: number;
            status: "PENDING_EMAIL_VERIFICATION" | "ACTIVE" | "LOCKED" | "DISABLED";
        };
    }>;
    refresh(request: Request, response: Response): Promise<{
        accessToken: string;
        user: {
            address: string | null;
            customerType: "INDIVIDUAL" | "STUDENT" | "BUSINESS" | null;
            displayName: string;
            email: string;
            emailVerifiedAt: Date | null;
            id: string;
            organizationName: string | null;
            phone: string | null;
            role: "SYSTEM_ADMIN" | "PROVIDER_ADMIN" | "CUSTOMER" | "SUPPORT_STAFF";
            sessionVersion: number;
            status: "PENDING_EMAIL_VERIFICATION" | "ACTIVE" | "LOCKED" | "DISABLED";
        };
    }>;
    logout(request: Request, response: Response): Promise<void>;
    profile(user: AuthPrincipal): Promise<{
        address: string | null;
        customerType: "INDIVIDUAL" | "STUDENT" | "BUSINESS" | null;
        displayName: string;
        email: string;
        emailVerifiedAt: Date | null;
        id: string;
        organizationName: string | null;
        phone: string | null;
        role: "SYSTEM_ADMIN" | "PROVIDER_ADMIN" | "CUSTOMER" | "SUPPORT_STAFF";
        sessionVersion: number;
        status: "PENDING_EMAIL_VERIFICATION" | "ACTIVE" | "LOCKED" | "DISABLED";
    }>;
    changePassword(user: AuthPrincipal, dto: ChangePasswordDto): Promise<{
        changed: boolean;
    }>;
    profileUpdate(user: AuthPrincipal, dto: ProfileDto): Promise<{
        address: string | null;
        customerType: "INDIVIDUAL" | "STUDENT" | "BUSINESS" | null;
        displayName: string;
        email: string;
        emailVerifiedAt: Date | null;
        id: string;
        organizationName: string | null;
        phone: string | null;
        role: "SYSTEM_ADMIN" | "PROVIDER_ADMIN" | "CUSTOMER" | "SUPPORT_STAFF";
        sessionVersion: number;
        status: "PENDING_EMAIL_VERIFICATION" | "ACTIVE" | "LOCKED" | "DISABLED";
    }>;
    lock(id: string, dto: StateDto, actor: AuthPrincipal): Promise<{
        address: string | null;
        customerType: "INDIVIDUAL" | "STUDENT" | "BUSINESS" | null;
        displayName: string;
        email: string;
        emailVerifiedAt: Date | null;
        id: string;
        organizationName: string | null;
        phone: string | null;
        role: "SYSTEM_ADMIN" | "PROVIDER_ADMIN" | "CUSTOMER" | "SUPPORT_STAFF";
        sessionVersion: number;
        status: "PENDING_EMAIL_VERIFICATION" | "ACTIVE" | "LOCKED" | "DISABLED";
    }>;
    unlock(id: string, dto: StateDto, actor: AuthPrincipal): Promise<{
        address: string | null;
        customerType: "INDIVIDUAL" | "STUDENT" | "BUSINESS" | null;
        displayName: string;
        email: string;
        emailVerifiedAt: Date | null;
        id: string;
        organizationName: string | null;
        phone: string | null;
        role: "SYSTEM_ADMIN" | "PROVIDER_ADMIN" | "CUSTOMER" | "SUPPORT_STAFF";
        sessionVersion: number;
        status: "PENDING_EMAIL_VERIFICATION" | "ACTIVE" | "LOCKED" | "DISABLED";
    }>;
    disable(id: string, dto: StateDto, actor: AuthPrincipal): Promise<{
        address: string | null;
        customerType: "INDIVIDUAL" | "STUDENT" | "BUSINESS" | null;
        displayName: string;
        email: string;
        emailVerifiedAt: Date | null;
        id: string;
        organizationName: string | null;
        phone: string | null;
        role: "SYSTEM_ADMIN" | "PROVIDER_ADMIN" | "CUSTOMER" | "SUPPORT_STAFF";
        sessionVersion: number;
        status: "PENDING_EMAIL_VERIFICATION" | "ACTIVE" | "LOCKED" | "DISABLED";
    }>;
    listUsers(query?: string): Promise<{
        address: string | null;
        customerType: "INDIVIDUAL" | "STUDENT" | "BUSINESS" | null;
        displayName: string;
        email: string;
        emailVerifiedAt: Date | null;
        id: string;
        organizationName: string | null;
        phone: string | null;
        role: "SYSTEM_ADMIN" | "PROVIDER_ADMIN" | "CUSTOMER" | "SUPPORT_STAFF";
        sessionVersion: number;
        status: "PENDING_EMAIL_VERIFICATION" | "ACTIVE" | "LOCKED" | "DISABLED";
    }[]>;
    userDetail(id: string): Promise<{
        address: string | null;
        customerType: "INDIVIDUAL" | "STUDENT" | "BUSINESS" | null;
        displayName: string;
        email: string;
        emailVerifiedAt: Date | null;
        id: string;
        organizationName: string | null;
        phone: string | null;
        role: "SYSTEM_ADMIN" | "PROVIDER_ADMIN" | "CUSTOMER" | "SUPPORT_STAFF";
        sessionVersion: number;
        status: "PENDING_EMAIL_VERIFICATION" | "ACTIVE" | "LOCKED" | "DISABLED";
    }>;
}
