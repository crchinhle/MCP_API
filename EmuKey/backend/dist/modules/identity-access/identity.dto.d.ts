export declare class CredentialsDto {
    email: string;
    password: string;
}
export declare class RegisterDto extends CredentialsDto {
    displayName: string;
    customerType: 'BUSINESS' | 'INDIVIDUAL' | 'STUDENT';
}
export declare class TokenDto {
    token: string;
}
export declare class EmailDto {
    email: string;
}
export declare class ResetPasswordDto {
    token: string;
    password: string;
}
export declare class ChangePasswordDto {
    currentPassword: string;
    password: string;
}
export declare class ProfileDto {
    displayName?: string;
    phone?: string;
    address?: string;
    organizationName?: string;
}
export declare class StateDto {
    reason: string;
}
