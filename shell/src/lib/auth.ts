import type { NextAuthOptions } from 'next-auth';

export const authOptions: NextAuthOptions = {
  providers: [
    {
      id: 'dex',
      name: 'ASuite',
      type: 'oauth',
      // Explicit endpoints — avoid wellKnown async fetch that can fail at signin init
      // Auth endpoint is public (browser redirect), token/userinfo are server-side (internal)
      authorization: {
        url: 'https://asuite.gridtabs.com/dex/auth',
        params: { scope: 'openid email profile offline_access' },
      },
      token: 'http://localhost:5556/dex/token',
      userinfo: 'http://localhost:5556/dex/userinfo',
      jwks_endpoint: 'http://localhost:5556/dex/keys',
      issuer: 'https://asuite.gridtabs.com/dex',
      clientId: process.env.DEX_CLIENT_ID!,
      clientSecret: process.env.DEX_CLIENT_SECRET!,
      checks: ['state'] as any,
      profile(profile: any) {
        return {
          id: profile.sub,
          name: profile.name || profile.email,
          email: profile.email,
          image: null,
        };
      },
    },
  ],
  callbacks: {
    async jwt({ token, account }: any) {
      if (account) {
        token.accessToken = account.access_token;
        token.idToken = account.id_token;
      }
      return token;
    },
    async session({ session, token }: any) {
      session.accessToken = token.accessToken;
      session.idToken = token.idToken;
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
};
