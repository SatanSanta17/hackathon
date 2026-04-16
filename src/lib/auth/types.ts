import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface User {
    platformRole?: string;
    isEmailVerified?: boolean;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      platformRole: string;
      isEmailVerified: boolean;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string;
    platformRole?: string;
    isEmailVerified?: boolean;
  }
}
