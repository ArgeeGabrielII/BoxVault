import { renderToString } from 'react-dom/server';
import LandingPage from '../public/LandingPage';
import LoginPage from '../public/LoginPage';
import { PrivacyPage, TermsPage, ThankYouPage, NotFoundPage } from '../public/PublicPages';
import { metadataFor, publicMetadata, siteConfig } from './metadata';
export const renderPublicPage = (route: string) => renderToString(route === '/' ? <LandingPage/> : route === '/login' ? <LoginPage/> : route === '/privacy' ? <PrivacyPage/> : route === '/terms' ? <TermsPage/> : route === '/thank-you' ? <ThankYouPage/> : <NotFoundPage/>);
export { metadataFor, publicMetadata, siteConfig };
