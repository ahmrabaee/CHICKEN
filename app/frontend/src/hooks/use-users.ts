
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userService } from '@/services/user.service';
import { UserListQuery, CreateUserDto, UpdateUserDto } from '@/types/user';
import { toast } from '@/hooks/use-toast';

/**
 * Hook to list users
 */
export const useUsers = (params?: UserListQuery) => {
    return useQuery({
        queryKey: ['users', params],
        queryFn: () => userService.getUsers(params),
    });
};

/**
 * Hook to get a single user
 */
export const useUser = (id: number) => {
    return useQuery({
        queryKey: ['users', id],
        queryFn: () => userService.getUser(id),
        enabled: !!id,
    });
};

/**
 * Hook to create a user
 */
export const useCreateUser = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreateUserDto) => userService.createUser(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            toast({
                title: 'تم إنشاء المستخدم بنجاح',
            });
        },
        onError: (error: any) => {
            toast({
                variant: 'destructive',
                title: 'خطأ في إنشاء المستخدم',
                description: error.response?.data?.message || 'حدث خطأ غير متوقع',
            });
        },
    });
};

/**
 * Hook to update a user
 */
export const useUpdateUser = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: UpdateUserDto }) =>
            userService.updateUser(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            queryClient.invalidateQueries({ queryKey: ['users', variables.id] });
            toast({
                title: 'تم تحديث بيانات المستخدم بنجاح',
            });
        },
        onError: (error: any) => {
            toast({
                variant: 'destructive',
                title: 'خطأ في تحديث البيانات',
                description: error.response?.data?.message || 'حدث خطأ غير متوقع',
            });
        },
    });
};

/**
 * Hook to deactivate a user
 */
export const useDeleteUser = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: number) => userService.deleteUser(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            toast({
                title: 'تم تعطيل حساب المستخدم بنجاح',
            });
        },
        onError: (error: any) => {
            toast({
                variant: 'destructive',
                title: 'خطأ في تعطيل الحساب',
                description: error.response?.data?.message || 'حدث خطأ غير متوقع',
            });
        },
    });
};

/**
 * Hook to get roles
 */
export const useRoles = () => {
    return useQuery({
        queryKey: ['roles'],
        queryFn: () => userService.getRoles(),
    });
};

/**
 * Hook to get active sessions
 */
export const useActiveSessions = () => {
    return useQuery({
        queryKey: ['active-sessions'],
        queryFn: () => userService.getActiveSessions(),
    });
};

/**
 * Hook to reset user password
 */
export const useResetPassword = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ userId, newPassword }: { userId: number; newPassword: string }) =>
            userService.resetUserPassword(userId, newPassword),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            queryClient.invalidateQueries({ queryKey: ['active-sessions'] });
            toast({
                title: 'تم إعادة تعيين كلمة المرور بنجاح',
                description: 'تم تسجيل خروج المستخدم من كافة الجلسات النشطة',
            });
        },
        onError: (error: any) => {
            toast({
                variant: 'destructive',
                title: 'خطأ في إعادة تعيين كلمة المرور',
                description: error.response?.data?.message || 'حدث خطأ غير متوقع',
            });
        },
    });
};
