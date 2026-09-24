import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { 
  ArrowRight, 
  Check, 
  TrendingUp, 
  Shield, 
  Zap, 
  Brain, 
  Database, 
  Globe,
  ChevronRight,
  Linkedin
} from 'lucide-react';
import { motion } from 'framer-motion';

const LandingPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useApp();

  const features = [
    { 
      icon: Brain, 
      title: 'AI-Powered Insights', 
      desc: 'Gemini-powered financial analysis',
      color: 'from-slate-700 to-slate-800'
    },
    {
      icon: TrendingUp,
      title: 'Income Forecasting',
      desc: 'Forecasts built from your real transaction volatility',
      color: 'from-slate-600 to-slate-700'
    },
    {
      icon: Shield,
      title: 'Row-Level Security',
      desc: 'Every user\'s data isolated at the database level',
      color: 'from-emerald-600 to-emerald-700'
    },
    {
      icon: Zap,
      title: 'Fast Analysis',
      desc: 'Full financial analysis in under 2 minutes',
      color: 'from-slate-500 to-slate-600'
    },
    {
      icon: Database,
      title: 'Multi-Modal Input',
      desc: 'Log transactions by text, photo, or voice',
      color: 'from-slate-700 to-slate-800'
    },
    {
      icon: Globe,
      title: 'Risk & Savings',
      desc: 'Real risk scoring and investment guidance',
      color: 'from-emerald-500 to-emerald-600'
    },
  ];

  const team = [
    {
      name: 'Nitish Kumar Singh',
      yearSection: '2nd Year, AIML',
      role: 'Backend Development',
      initials: 'NK',
      image: '/nitish.png',
      isLeader: true
    },
    {
      name: 'Palak',
      yearSection: '2nd Year, CSE',
      role: 'Presentation, UI Design',
      initials: 'PL',
      image: '/palak.jpg',
      isLeader: false
    },
    {
      name: 'Stuti Bhatnagar',
      yearSection: '2nd Year, AIML',
      role: 'PPT, Database Management',
      initials: 'SB',
      image: '/stuti.jpg',
      isLeader: false
    },
    {
      name: 'Prateek',
      yearSection: '2nd Year, CSE',
      role: 'Frontend Development',
      initials: 'PK',
      image: '/prateek.jpg',
      isLeader: false
    },
    {
      name: 'Dev Srivastava',
      yearSection: '2nd Year, CSE',
      role: 'Design, Problem Solving',
      initials: 'DS',
      image: '/dev.jpg',
      isLeader: false
    },
    {
      name: 'Daksh Goyal',
      yearSection: '2nd Year, CSE',
      role: 'Testing',
      initials: 'DG',
      image: '/daksh.jpg',
      isLeader: false
    }
  ];

  const stats = [
    { number: '230M+', label: 'Gig Workers Targeted' },
    { number: '9', label: 'AI Agents' },
    { number: '<2 min', label: 'Full Analysis' },
    { number: '100%', label: 'Privacy Protected' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 pt-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-blue-50/30" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.1),rgba(255,255,255,0))]" />
        
        <div className="relative max-w-6xl mx-auto px-4 py-20 sm:py-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            {/* Brand Badge */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-sm font-medium mb-8 shadow-xs"
            >
              <div className="w-5 h-5 rounded-md bg-black flex items-center justify-center p-0.5 border border-slate-800">
                <img src="/arthasetu-logo.png" alt="ArthaSetu" className="w-full h-full object-contain" />
              </div>
              AI-Powered Financial Companion for Bharat
            </motion.div>

            {/* Main Heading */}
            <motion.h1
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-5xl sm:text-6xl lg:text-7xl font-bold text-slate-900 mb-6 leading-tight"
            >
              <div className="flex items-center justify-center gap-3.5 mb-2">
                <div className="w-14 h-14 sm:w-18 sm:h-18 rounded-2xl bg-black flex items-center justify-center p-2.5 shadow-xl border border-slate-800">
                  <img src="/arthasetu-logo.png" alt="ArthaSetu Logo" className="w-full h-full object-contain" />
                </div>
                <span className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-600 bg-clip-text text-transparent">
                  ArthaSetu
                </span>
              </div>
              <span className="text-3xl sm:text-4xl lg:text-5xl text-slate-600 font-normal">
                Financial Intelligence
              </span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-xl text-slate-600 mb-4 max-w-3xl mx-auto leading-relaxed"
            >
              Lakshmi Raave Maa Intiki: Your Smart Financial Companion for Daily Earnings
            </motion.p>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="text-lg text-slate-500 mb-12 max-w-2xl mx-auto"
            >
              Empowering 230M+ gig workers with AI-powered financial intelligence, 
              personalized guidance, and proactive wealth management in real-time.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="flex flex-col sm:flex-row gap-4 justify-center mb-16"
            >
              {isAuthenticated && user ? (
                <Button
                  size="lg"
                  onClick={() => navigate('/dashboard')}
                  className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-6 text-lg font-medium shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  Go to Dashboard ({user.name?.split(' ')[0] || 'My Account'})
                  <ArrowRight className="ml-2" size={20} />
                </Button>
              ) : (
                <>
                  <Button
                    size="lg"
                    onClick={() => navigate('/signup')}
                    className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-6 text-lg font-medium shadow-lg hover:shadow-xl transition-all duration-300"
                  >
                    Start Your Journey
                    <ArrowRight className="ml-2" size={20} />
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => navigate('/login')}
                    className="border-slate-300 text-slate-700 hover:bg-slate-50 px-8 py-6 text-lg font-medium"
                  >
                    Sign In
                    <ChevronRight className="ml-2" size={20} />
                  </Button>
                </>
              )}
            </motion.div>

            {/* Stats Grid */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto"
            >
              {stats.map((stat, idx) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1 + idx * 0.1 }}
                  className="text-center"
                >
                  <div className="text-3xl font-bold text-slate-900 mb-1">{stat.number}</div>
                  <div className="text-sm text-slate-500">{stat.label}</div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold text-slate-900 mb-4">
              Intelligent Financial Management
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Advanced AI capabilities designed specifically for the unique challenges of gig economy workers
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, idx) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="p-6 h-full hover:shadow-lg transition-shadow border-slate-200">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${feature.color} flex items-center justify-center mb-4`}>
                    <feature.icon className="text-white" size={24} />
                  </div>
                  <h3 className="font-semibold text-slate-900 mb-2">{feature.title}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">{feature.desc}</p>
                </Card>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            viewport={{ once: true }}
            className="mt-12 text-center"
          >
            <Button
              onClick={() => navigate('/signup')}
              className="bg-slate-900 hover:bg-slate-800 text-white"
            >
              Get Started Now
              <ArrowRight className="ml-2" size={16} />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <Badge className="bg-slate-900 text-white mb-6">About ArthaSetu</Badge>
              <h2 className="text-4xl font-bold text-slate-900 mb-6">
                Built for India's Gig Economy
              </h2>
              <p className="text-lg text-slate-600 mb-6 leading-relaxed">
                Unlike traditional fintech solutions built for salaried workers, ArthaSetu understands 
                the unique challenges of gig work: daily volatility, seasonal fluctuations, weather 
                dependencies, and cultural spending cycles.
              </p>
              <div className="space-y-3 mb-8">
                {[
                  'Connects to 200+ government schemes and opportunities',
                  'Tax compliance automation with deduction optimization',
                  'Real-time financial insights while maintaining 100% privacy',
                  'Multi-agent AI processing for personalized recommendations'
                ].map((benefit, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check size={14} className="text-emerald-600" />
                    </div>
                    <span className="text-slate-600">{benefit}</span>
                  </div>
                ))}
              </div>
              <Button
                onClick={() => navigate('/signup')}
                className="bg-slate-900 hover:bg-slate-800 text-white"
              >
                Start Using ArthaSetu
                <ArrowRight className="ml-2" size={16} />
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="relative"
            >
              <Card className="p-8 bg-white shadow-xl">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-r from-slate-700 to-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Brain className="text-white" size={32} />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-4">
                    AI-Powered Intelligence
                  </h3>
                  <p className="text-slate-600 mb-6">
                    Our multi-agent system computes real numbers from your real transaction
                    history, with strict data isolation enforced by Postgres Row-Level Security.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-slate-50 rounded-lg">
                      <div className="font-bold text-slate-900">9</div>
                      <div className="text-xs text-slate-600">AI Agents</div>
                    </div>
                    <div className="text-center p-4 bg-slate-50 rounded-lg">
                      <div className="font-bold text-slate-900">&lt;2min</div>
                      <div className="text-xs text-slate-600">Full Analysis</div>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-800 text-xs font-semibold tracking-wider uppercase mb-4 shadow-sm">
              Team Invictus
            </div>
            <h2 className="text-4xl font-bold text-slate-900 mb-4">Meet Team Invictus</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Driven by innovation: 2nd-year CSE & AIML engineers building intelligent, accessible financial technology for gig economy workers.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {team.map((member, idx) => (
              <motion.div
                key={member.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.08 }}
                viewport={{ once: true }}
              >
                <Card className="p-6 text-center hover:shadow-xl hover:-translate-y-1 transition-all duration-300 rounded-2xl border border-slate-200/80 bg-white h-full flex flex-col justify-between shadow-sm">
                  <div>
                    <Avatar className="w-16 h-16 mx-auto mb-4 ring-4 ring-slate-100 shadow-sm overflow-hidden">
                      {member.image && (
                        <AvatarImage src={member.image} alt={member.name} className="object-cover w-full h-full" />
                      )}
                      <AvatarFallback className="bg-slate-900 text-white text-lg font-bold">
                        {member.initials}
                      </AvatarFallback>
                    </Avatar>

                    <h3 className="font-semibold text-slate-900 text-lg mb-1.5">{member.name}</h3>

                    <div className="flex flex-wrap items-center justify-center gap-1.5 mb-3">
                      <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full">
                        {member.yearSection}
                      </span>
                      {member.isLeader && (
                        <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200/80 px-2.5 py-0.5 rounded-full">
                          Team Leader
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-slate-600 leading-relaxed font-normal">
                      {member.role}
                    </p>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-slate-900">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl font-bold text-white mb-6">
              Ready to Transform Your Financial Future?
            </h2>
            <p className="text-xl text-slate-300 mb-10 max-w-2xl mx-auto">
              Join the revolution in financial management designed specifically for gig economy workers.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {isAuthenticated && user ? (
                <Button
                  size="lg"
                  onClick={() => navigate('/dashboard')}
                  className="bg-white text-slate-900 hover:bg-slate-100 px-8 py-6 text-lg font-medium"
                >
                  Open Dashboard ({user.name?.split(' ')[0] || 'My Account'})
                  <ArrowRight className="ml-2" size={20} />
                </Button>
              ) : (
                <>
                  <Button
                    size="lg"
                    onClick={() => navigate('/signup')}
                    className="bg-white text-slate-900 hover:bg-slate-100 px-8 py-6 text-lg font-medium"
                  >
                    Get Started Free
                    <ArrowRight className="ml-2" size={20} />
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => navigate('/login')}
                    className="bg-transparent border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white px-8 py-6 text-lg font-medium"
                  >
                    Sign In
                  </Button>
                </>
              )}
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;