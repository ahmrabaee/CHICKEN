import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { authService } from '@/services/auth.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const Login = () => {
    const navigate = useNavigate();
    const { login: contextLogin, isAuthenticated } = useAuth();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // Redirect if already authenticated
    useEffect(() => {
        if (isAuthenticated) {
            navigate('/', { replace: true });
        }
    }, [isAuthenticated, navigate]);

    if (isAuthenticated) {
        return null;
    }

    const handleLogin = async () => {
        // Validation
        if (!username.trim()) {
            setError('اسم المستخدم مطلوب');
            return;
        }
        if (!password) {
            setError('كلمة المرور مطلوبة');
            return;
        }

        setError('');
        setIsLoading(true);

        try {
            const response = await authService.login({ username, password });

            // Update auth context
            contextLogin(response.accessToken, response.refreshToken, response.user);

            toast({
                title: 'تم تسجيل الدخول بنجاح',
                description: `مرحباً ${response.user.fullName}`,
            });

            navigate('/', { replace: true });
        } catch (err: any) {
            console.error('Login error:', err);

            const message = err.response?.data?.message ||
                err.response?.data?.data?.messageAr ||
                err.message ||
                'خطأ في تسجيل الدخول';
            setError(message);

            toast({
                variant: 'destructive',
                title: 'خطأ في تسجيل الدخول',
                description: message,
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div dir="rtl" className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="space-y-1 text-center">
                    <CardTitle className="text-3xl font-bold">مرحباً بك</CardTitle>
                    <CardDescription>
                        قم بتسجيل الدخول للوصول إلى نظام إدارة محل الدجاج
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Username */}
                    <div className="space-y-2">
                        <Label htmlFor="username">اسم المستخدم</Label>
                        <Input
                            id="username"
                            type="text"
                            placeholder="أدخل اسم المستخدم"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            disabled={isLoading}
                            className="text-right"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleLogin();
                                }
                            }}
                        />
                    </div>

                    {/* Password */}
                    <div className="space-y-2">
                        <Label htmlFor="password">كلمة المرور</Label>
                        <div className="relative">
                            <Input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                placeholder="أدخل كلمة المرور"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={isLoading}
                                className="text-right pr-10"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleLogin();
                                    }
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    {/* Error message */}
                    {error && (
                        <div className="text-sm text-red-500 text-center p-2 bg-red-50 rounded">
                            {error}
                        </div>
                    )}

                    {/* Submit Button */}
                    <Button
                        type="button"
                        className="w-full"
                        disabled={isLoading}
                        onClick={handleLogin}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                                جاري تسجيل الدخول...
                            </>
                        ) : (
                            'تسجيل الدخول'
                        )}
                    </Button>
                </CardContent>
                <CardFooter className="flex justify-center">
                    <p className="text-xs text-muted-foreground text-center">
                        © 2026 نظام إدارة محل الدجاج. جميع الحقوق محفوظة.
                    </p>
                </CardFooter>
            </Card>
        </div>
    );
};

export default Login;
