import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';

const ForgotPassword = () => {
    return (
        <div dir="rtl" className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="space-y-1 text-center">
                    <CardTitle className="text-3xl font-bold">نسيت كلمة المرور</CardTitle>
                    <CardDescription>
                        استعادة الوصول إلى حسابك
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                            لاستعادة كلمة المرور، يرجى التواصل مع المسؤول لإعادة تعيين كلمة المرور الخاصة بك.
                        </AlertDescription>
                    </Alert>
                    <div className="text-sm text-muted-foreground text-center">
                        <p>
                            إذا كنت تتذكر كلمة المرور الخاصة بك، يمكنك <Link to="/login" className="font-medium text-primary hover:text-primary/80">العودة لتسجيل الدخول</Link>
                        </p>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-center">
                    <Button asChild variant="outline">
                        <Link to="/login">العودة إلى تسجيل الدخول</Link>
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
};

export default ForgotPassword;
