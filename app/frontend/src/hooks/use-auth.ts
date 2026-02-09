import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/services/auth.service';
import { setTokens, clearTokens, getStoredUser } from '@/lib/auth';
import { useAuth } from '@/context/AuthContext';
import type { LoginDto, ChangePasswordDto, AuthUserResponse } from '@/types/auth';
import { toast } from '@/hooks/use-toast';

/**
 * Hook for login mutation
 */
export const useLogin = () => {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const { login: syncLogin } = useAuth();

    return useMutation({
        mutationFn: async (credentials: LoginDto) => {
            console.log('📤 إرسال طلب تسجيل الدخول:', credentials);
            const result = await authService.login(credentials);
            console.log('✅ نتيجة تسجيل الدخول:', result);
            return result;
        },
        onSuccess: (data) => {
            console.log('🎉 Login successful! Data:', data);

            // Reactive login update
            syncLogin(data.accessToken, data.refreshToken, data.user);

            // Show success message
            toast({
                title: 'تم تسجيل الدخول بنجاح',
                description: `مرحباً ${data.user.fullName}`,
            });

            // Navigate to dashboard reactively
            console.log('🔀 Navigating to dashboard...');
            navigate('/');
        },
        onError: (error: any) => {
            console.error('❌ خطأ في تسجيل الدخول:', error);
            console.error('❌ تفاصيل الخطأ:', error.response?.data);
            toast({
                variant: 'destructive',
                title: 'خطأ في تسجيل الدخول',
                description: error.response?.data?.message || 'اسم المستخدم أو كلمة المرور غير صحيحة',
            });
        },
    });
};

/**
 * Hook for logout mutation
 */
export const useLogout = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { logout: syncLogout } = useAuth();

    return useMutation({
        mutationFn: () => authService.logout(),
        onSuccess: () => {
            // Reactive logout update
            syncLogout();

            // Clear all cached queries
            queryClient.clear();

            // Show success message
            toast({
                title: 'تم تسجيل الخروج بنجاح',
            });

            // Redirect to login
            navigate('/login');
        },
        onError: () => {
            // Even if API call fails, still clear local data and redirect
            clearTokens();
            queryClient.clear();
            navigate('/login');
        },
    });
};

/**
 * Hook for change password mutation
 */
export const useChangePassword = () => {
    return useMutation({
        mutationFn: (data: ChangePasswordDto) => authService.changePassword(data),
        onSuccess: (data) => {
            toast({
                title: 'تم تغيير كلمة المرور بنجاح',
                description: data.messageAr || data.message,
            });
        },
        onError: (error: any) => {
            toast({
                variant: 'destructive',
                title: 'خطأ في تغيير كلمة المرور',
                description: error.response?.data?.message || 'كلمة المرور الحالية غير صحيحة',
            });
        },
    });
};

/**
 * Hook to get current user from stored data
 */
export const useCurrentUser = (): AuthUserResponse | null => {
    return getStoredUser();
};
