'use client';

import React, { useState } from 'react';
import { useSignUp } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Button, Input, Card, CardBody, CardHeader, Link } from '@heroui/react';
import { Eye, EyeOff, Lock, Mail, ArrowRight, UserPlus, User } from 'lucide-react';
import { createLogger } from '@/utils/logger/Logger';

const logger = createLogger('AdminSignUpForm');

export default function AdminSignUpForm() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [code, setCode] = useState('');
  const router = useRouter();

  const toggleVisibility = () => setIsVisible(!isVisible);

  // 1. Регистрация
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !signUp) return;
    
    setIsLoading(true);
    setError('');

    try {
      await signUp.create({
        firstName,
        emailAddress: email,
        password,
      });

      // Отправляем код подтверждения на email
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      logger.success('Email verification prepared', { email });
      setVerifying(true);
    } catch (err: any) {
      logger.error('SignUp error', err);
      const msg = err.errors?.[0]?.message || err.message;
      if (msg.includes('already exists')) {
          setError('Такой пользователь уже существует');
      } else if (msg.includes('password')) {
          setError('Пароль слишком простой');
      } else {
          setError('Ошибка регистрации. Проверьте данные.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Подтверждение email
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !signUp) return;

    setIsLoading(true);
    setError('');

    try {
      const result = await signUp.attemptEmailAddressVerification({
        code,
      });

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.push('/admin');
      } else {
        setError('Неверный код подтверждения');
      }
    } catch (err: any) {
       setError('Ошибка проверки кода');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleGoogleSignUp = async () => {
    if (!isLoaded || !signUp) return;
    try {
      await signUp.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: '/sso-callback',
        redirectUrlComplete: '/admin',
      });
    } catch (err) {
      setError('Ошибка регистрации через Google');
    }
  };

  if (verifying) {
     return (
        <Card className="w-full max-w-[400px] shadow-medium bg-content1">
           <CardHeader className="flex flex-col gap-2 items-center pt-8 px-8 pb-0">
              <h1 className="text-2xl font-bold text-center">Подтверждение</h1>
              <p className="text-small text-default-500 text-center">
                 Код отправлен на {email}
              </p>
           </CardHeader>
           <CardBody className="px-8 py-8">
              <form onSubmit={handleVerify} className="flex flex-col gap-4">
                 {error && (
                    <div className="text-danger text-sm text-center bg-danger/10 p-2 rounded-medium mb-2">
                       {error}
                    </div>
                 )}
                 <Input
                    isRequired
                    label="Код подтверждения"
                    placeholder="123456"
                    variant="bordered"
                    value={code}
                    onValueChange={setCode}
                    classNames={{ inputWrapper: "bg-default-50 hover:bg-default-100" }}
                 />
                 <Button color="primary" type="submit" isLoading={isLoading} className="mt-2 font-medium">
                    Подтвердить
                 </Button>
              </form>
           </CardBody>
        </Card>
     );
  }

  return (
    <Card className="w-full max-w-[400px] shadow-medium bg-content1">
      <CardHeader className="flex flex-col gap-2 items-center pt-8 px-8 pb-0">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <UserPlus className="text-primary w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold text-center">Регистрация</h1>
        <p className="text-small text-default-500 text-center">
           Создайте аккаунт администратора
        </p>
      </CardHeader>
      
      <CardBody className="px-8 py-8">
        <div className="flex flex-col gap-4">
          <Button
            className="w-full bg-default-100 hover:bg-default-200 text-foreground font-medium"
            startContent={
               <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
               </svg>
            }
            onPress={handleGoogleSignUp}
          >
            Google
          </Button>

          <div className="flex items-center gap-2">
             <div className="h-[1px] flex-1 bg-default-200" />
             <span className="text-xs text-default-400">или по email</span>
             <div className="h-[1px] flex-1 bg-default-200" />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
               <div className="text-danger text-sm text-center bg-danger/10 p-2 rounded-medium mb-2">
                  {error}
               </div>
            )}

            <Input
               isRequired
               label="Имя"
               placeholder="Ваше имя"
               variant="bordered"
               value={firstName}
               onValueChange={setFirstName}
               startContent={<User className="text-default-400 pointer-events-none flex-shrink-0" size={18} />}
               classNames={{ inputWrapper: "bg-default-50 hover:bg-default-100" }}
            />

            <Input
               isRequired
               label="Email"
               placeholder="admin@example.com"
               type="email"
               variant="bordered"
               value={email}
               onValueChange={setEmail}
               startContent={<Mail className="text-default-400 pointer-events-none flex-shrink-0" size={18} />}
               classNames={{ inputWrapper: "bg-default-50 hover:bg-default-100" }}
            />

            <Input
               isRequired
               label="Пароль"
               placeholder="Придумайте пароль"
               variant="bordered"
               value={password}
               onValueChange={setPassword}
               startContent={<Lock className="text-default-400 pointer-events-none flex-shrink-0" size={18} />}
               endContent={
                 <button className="focus:outline-none" type="button" onClick={toggleVisibility}>
                   {isVisible ? <EyeOff size={18} className="text-default-400" /> : <Eye size={18} className="text-default-400" />}
                 </button>
               }
               type={isVisible ? "text" : "password"}
               classNames={{ inputWrapper: "bg-default-50 hover:bg-default-100" }}
            />

            <div id="clerk-captcha" />

            <Button 
               color="primary" 
               type="submit" 
               className="mt-2 font-medium"
               isLoading={isLoading}
               endContent={!isLoading && <ArrowRight size={18} />}
            >
               Зарегистрироваться
            </Button>
          </form>

          <div className="text-center text-sm text-default-500 mt-2">
             Уже есть аккаунт?{' '}
             <Link href="/admin/auth/login" size="sm" className="text-primary font-medium">
                Войти
             </Link>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

