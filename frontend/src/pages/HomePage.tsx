import React, { useEffect } from 'react';
import {
  Search,
  Sparkles,
  Zap,
  Shield,
  Globe,
  ChevronRight,
  Cloud,
  Heart,
  Layers,
  Moon,
  Sun,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Settings,
} from 'lucide-react';
import { useAuthStore, useThemeStore, useProxyStore } from '@/stores';
import { Button } from '@/components/ui';
import { useNavigate, Link } from 'react-router-dom';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { resolvedTheme, toggleTheme } = useThemeStore();
  const { isEnabled: isProxyEnabled, status: proxyStatus, isLoading: isProxyLoading, toggleProxy, initializeProxy } = useProxyStore();

  useEffect(() => {
    initializeProxy();
  }, [initializeProxy]);

  const features = [
    {
      icon: <Zap className="w-6 h-6" />,
      title: '极速搜索',
      description: '多源并发搜索，快速获取结果，节省您的宝贵时间',
      color: 'bg-gradient-to-br from-amber-400 to-orange-500',
      gradient: true,
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: '安全可靠',
      description: '智能过滤有害内容，保护您的设备和隐私安全',
      color: 'bg-gradient-to-br from-emerald-400 to-teal-500',
      gradient: true,
    },
    {
      icon: <Globe className="w-6 h-6" />,
      title: '资源丰富',
      description: '聚合多个优质资源站点，一站式搜索体验',
      color: 'bg-gradient-to-br from-blue-400 to-cyan-500',
      gradient: true,
    },
    {
      icon: <Cloud className="w-6 h-6" />,
      title: '云端同步',
      description: '收藏和历史记录云端存储,多设备无缝切换',
      color: 'bg-gradient-to-br from-violet-400 to-purple-500',
      gradient: true,
    },
    {
      icon: <Heart className="w-6 h-6" />,
      title: '智能收藏',
      description: '一键收藏喜爱的资源,随时回顾精彩内容',
      color: 'bg-gradient-to-br from-rose-400 to-pink-500',
      gradient: true,
    },
    {
      icon: <Layers className="w-6 h-6" />,
      title: '分类管理',
      description: '清晰的分类体系,快速找到所需资源类型',
      color: 'bg-gradient-to-br from-cyan-400 to-teal-500',
      gradient: true,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-50 via-white to-primary-50/50 dark:from-surface-950 dark:via-surface-900 dark:to-primary-950/30">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 dark:bg-surface-900/90 backdrop-blur-xl border-b border-surface-200/50 dark:border-surface-700/50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-lg shadow-primary-500/25 group-hover:shadow-primary-500/40 transition-shadow">
                <Search className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent">
                磁力快搜
              </span>
            </Link>
            <div className="flex items-center gap-2 sm:gap-2">
              <button
                onClick={toggleProxy}
                disabled={isProxyLoading}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  isProxyEnabled 
                    ? 'text-success-600 hover:text-success-700 hover:bg-success-50 dark:text-success-400 dark:hover:bg-success-900/20' 
                    : proxyStatus === 'error'
                    ? 'text-error-500 hover:text-error-600 hover:bg-error-50 dark:hover:bg-error-900/20'
                    : 'text-surface-500 hover:text-surface-700 hover:bg-surface-100 dark:text-surface-400 dark:hover:text-surface-200 dark:hover:bg-surface-800'
                }`}
                title={isProxyEnabled ? '代理已启用 - 点击关闭' : '代理已关闭 - 点击启用'}
              >
                {isProxyLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : isProxyEnabled ? (
                  <ShieldCheck className="w-5 h-5" />
                ) : proxyStatus === 'error' ? (
                  <ShieldAlert className="w-5 h-5" />
                ) : (
                  <Shield className="w-5 h-5" />
                )}
              </button>
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg text-surface-500 hover:text-surface-700 hover:bg-surface-100 dark:text-surface-400 dark:hover:text-surface-200 dark:hover:bg-surface-800 transition-colors"
              >
                {resolvedTheme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              {isAuthenticated ? (
                <Button variant="primary" onClick={() => navigate('/main')}>
                  进入主页
                </Button>
              ) : (
                <>
                  <Button variant="ghost" onClick={() => navigate('/login')}>
                    登录
                  </Button>
                  <Button variant="primary" onClick={() => navigate('/register')}>
                    免费注册
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary-50 via-white to-white dark:from-primary-950/30 dark:via-surface-950 dark:to-surface-950" />
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary-400/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-40 right-1/4 w-80 h-80 bg-accent-400/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }} />
        
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-sm font-medium mb-8 animate-fade-in">
            <Sparkles className="w-4 h-4" />
            <span>简洁高效的磁力搜索工具</span>
          </div>
          
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-surface-900 dark:text-surface-100 mb-6 leading-tight">
            一站式
            <span className="bg-gradient-to-r from-primary-500 to-accent-500 bg-clip-text text-transparent">磁力搜索</span>
            <br />
            解决方案
          </h1>
          
          <p className="text-lg sm:text-xl text-surface-600 dark:text-surface-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            聚合多个优质资源站点，提供快速、安全、便捷的搜索体验。
            支持云端同步、智能收藏，让资源管理更轻松。
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              variant="primary"
              size="lg"
              onClick={() => navigate(isAuthenticated ? '/main' : '/register')}
              rightIcon={<ChevronRight className="w-5 h-5" />}
            >
              {isAuthenticated ? '开始搜索' : '立即体验'}
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate('/login')}
            >
              已有账号？登录
            </Button>
          </div>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-surface-50 dark:bg-surface-900/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-surface-900 dark:text-surface-100 mb-4">
              产品特色
            </h2>
            <p className="text-surface-600 dark:text-surface-400 max-w-2xl mx-auto">
              我们致力于提供最佳的磁力搜索体验，以下是我们产品的核心功能
            </p>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group p-6 bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-xl hover:shadow-primary-500/5 transition-all duration-300 hover:-translate-y-1"
              >
                <div className={`w-14 h-14 ${feature.color} rounded-xl flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-2">
                  {feature.title}
                </h3>
                <p className="text-surface-600 dark:text-surface-400 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-surface-900 dark:text-surface-100 mb-4">
              使用流程
            </h2>
            <p className="text-surface-600 dark:text-surface-400">
              简单三步，开始您的搜索之旅
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-8">
            {[
              { step: '01', title: '注册账号', desc: '快速注册，开启个性化体验', icon: <Settings className="w-5 h-5" /> },
              { step: '02', title: '搜索资源', desc: '输入关键词，一键搜索全网', icon: <Search className="w-5 h-5" /> },
              { step: '03', title: '收藏管理', desc: '收藏喜爱的资源，随时查看', icon: <Heart className="w-5 h-5" /> },
            ].map((item, index) => (
              <div key={index} className="text-center group">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 text-white text-2xl font-bold mb-4 shadow-lg shadow-primary-500/25 group-hover:shadow-primary-500/40 transition-shadow">
                  {item.step}
                </div>
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center text-white">
                  {item.icon}
                </div>
                <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-2">
                  {item.title}
                </h3>
                <p className="text-surface-600 dark:text-surface-400 text-sm">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-primary-500 to-accent-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            准备好开始了吗？
          </h2>
          <p className="text-white/80 mb-8 max-w-xl mx-auto">
            简单几步，即可开始您的搜索之旅
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              variant="secondary"
              size="lg"
              onClick={() => navigate('/register')}
              rightIcon={<ChevronRight className="w-5 h-5" />}
            >
              免费注册
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate('/login')}
              className="border-white/30 text-white hover:bg-white/10"
            >
              已有账号
            </Button>
          </div>
        </div>
      </section>

    </div>
  );
};
