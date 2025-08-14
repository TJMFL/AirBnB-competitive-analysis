import { useState } from 'react';
import { TrendingUp, AlertCircle, Star, Calendar, DollarSign, Home, RefreshCw, BarChart3, Lightbulb, FileText, Bell, CheckCircle, XCircle, Clock, MapPin, Users } from 'lucide-react';

const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3001' : '';

interface Analysis {
    listingId: string;
    userListing: {
        id: string;
        name: string;
        currentPrice: number;
        rating: number;
        reviews: number;
        amenities: string[];
        description: string;
        location: {
            city: string;
            neighborhood: string;
        };
        propertyType: string;
    };
    competitors: Array<{
        id: string;
        name: string;
        price: number;
        rating: number;
        reviews: number;
        amenities: string[];
        location: {
            city: string;
            neighborhood: string;
            distance?: number;
        };
        propertyType: string;
    }>;
    pricingRecommendations: {
        currentMarketPosition: string;
        suggestedPriceRange: {
            min: number;
            max: number;
            optimal: number;
        };
        reasoning: string;
        competitorComparison: string;
        demandIndicators: string[];
        seasonalInsights: string;
    };
    featureAnalysis: {
        userAmenities: string[];
        missingAmenities: Array<{
            amenity: string;
            prevalence: number;
            description: string;
        }>;
        uniqueAmenities: string[];
        competitorAmenities: Array<{
            amenity: string;
            competitorCount: number;
            competitorPercentage: number;
        }>;
    };
    descriptionAnalysis: {
        currentDescription: string;
        wordCount: number;
        readabilityScore: number;
        keywordAnalysis: {
            presentKeywords: string[];
            missingKeywords: string[];
            competitorKeywords: string[];
        };
        structureAnalysis: {
            hasIntro: boolean;
            hasLocationInfo: boolean;
            hasAmenityList: boolean;
            hasBookingInfo: boolean;
            hasCTA: boolean;
        };
        suggestions: string[];
        optimizedDescription: string;
    };
    marketAnalysis: {
        totalCompetitorsAnalyzed: number;
        averagePrice: number;
        priceRange: {
            min: number;
            max: number;
        };
        averageRating: number;
        mostCommonAmenities: Array<{
            amenity: string;
            percentage: number;
        }>;
        marketTrends: string[];
    };
    analyzedAt: string;
    fromCache?: boolean;
    cacheAge?: number;
}

interface Alert {
    _id: string;
    type: string;
    title: string;
    message: string;
    impact: string;
    data?: any;
    createdAt: string;
    isRead: boolean;
}

const AirbnbCompetitiveAnalysisDemo = () => {
    const [listingId, setListingId] = useState('');
    const [analysis, setAnalysis] = useState<Analysis | null>(null);
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('pricing');
    const [refreshing, setRefreshing] = useState(false);

    const analyzeListing = async () => {
        if (!listingId.trim()) return;

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`${API_BASE}/api/analyze`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ listingId: listingId.trim() }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.details || errorData.error || 'Analysis failed');
            }

            const data = await response.json();
            setAnalysis(data.data);
            setAlerts(data.alerts || []);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred');
            console.error('Analysis failed:', err);
        } finally {
            setLoading(false);
        }
    };

    const refreshAnalysis = async () => {
        if (!analysis?.listingId) return;

        setRefreshing(true);
        try {
            const response = await fetch(`${API_BASE}/api/refresh/${analysis.listingId}`, {
                method: 'POST',
            });

            if (response.ok) {
                const data = await response.json();
                setAnalysis(data.data);
                setAlerts([]);
            }
        } catch (err) {
            console.error('Refresh failed:', err);
        } finally {
            setRefreshing(false);
        }
    };

    const getMarketPositionColor = (position: string) => {
        switch (position) {
            case 'below_market':
                return 'text-red-600';
            case 'at_market':
                return 'text-green-600';
            case 'above_market':
                return 'text-blue-600';
            default:
                return 'text-gray-600';
        }
    };

    const getMarketPositionText = (position: string) => {
        switch (position) {
            case 'below_market':
                return 'Below Market';
            case 'at_market':
                return 'At Market';
            case 'above_market':
                return 'Above Market';
            default:
                return 'Unknown';
        }
    };

    const getImpactColor = (impact: string) => {
        switch (impact) {
            case 'high':
                return 'border-red-400 bg-red-50 text-red-800';
            case 'medium':
                return 'border-yellow-400 bg-yellow-50 text-yellow-800';
            case 'low':
                return 'border-blue-400 bg-blue-50 text-blue-800';
            case 'opportunity':
                return 'border-green-400 bg-green-50 text-green-800';
            default:
                return 'border-gray-400 bg-gray-50 text-gray-800';
        }
    };

    const PricingOptimization = () => {
        if (!analysis) return null;

        const { userListing, pricingRecommendations, marketAnalysis, competitors } = analysis;

        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-lg border border-gray-200">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-gray-900">Current Price</h3>
                            <DollarSign className="h-5 w-5 text-gray-400" />
                        </div>
                        <p className="text-3xl font-bold text-gray-900 mt-2">${userListing.currentPrice || 'N/A'}</p>
                        <p className={`text-sm mt-1 ${getMarketPositionColor(pricingRecommendations.currentMarketPosition)}`}>
                            {getMarketPositionText(pricingRecommendations.currentMarketPosition)}
                        </p>
                    </div>

                    <div className="bg-white p-6 rounded-lg border border-gray-200">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-gray-900">Suggested Price</h3>
                            <TrendingUp className="h-5 w-5 text-green-500" />
                        </div>
                        <p className="text-3xl font-bold text-green-600 mt-2">
                            ${pricingRecommendations.suggestedPriceRange.optimal}
                        </p>
                        <p className="text-sm text-green-600 mt-1">
                            Range: ${pricingRecommendations.suggestedPriceRange.min}-${pricingRecommendations.suggestedPriceRange.max}
                        </p>
                    </div>

                    <div className="bg-white p-6 rounded-lg border border-gray-200">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-gray-900">Market Average</h3>
                            <BarChart3 className="h-5 w-5 text-blue-500" />
                        </div>
                        <p className="text-3xl font-bold text-blue-600 mt-2">${marketAnalysis.averagePrice}</p>
                        <p className="text-sm text-gray-600 mt-1">{marketAnalysis.totalCompetitorsAnalyzed} competitors analyzed</p>
                    </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <h4 className="text-lg font-semibold text-blue-900 mb-2">AI Pricing Analysis</h4>
                    <p className="text-blue-800 mb-4">{pricingRecommendations.reasoning}</p>
                    <div className="text-sm text-blue-700">
                        <p><strong>Market Comparison:</strong> {pricingRecommendations.competitorComparison}</p>
                        {pricingRecommendations.seasonalInsights && (
                            <p className="mt-2"><strong>Seasonal Insights:</strong> {pricingRecommendations.seasonalInsights}</p>
                        )}
                    </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h4 className="text-lg font-semibold text-gray-900">Real Competitor Analysis</h4>
                        <p className="text-sm text-gray-600 mt-1">Based on {competitors.length} active listings in your area</p>
                    </div>
                    <div className="p-6">
                        <div className="space-y-4">
                            {competitors.map((comp, idx) => (
                                <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                    <div className="flex-1">
                                        <p className="font-medium text-gray-900">{comp.name}</p>
                                        <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                                            <span className="flex items-center">
                                                <Star className="h-4 w-4 text-yellow-500 mr-1" />
                                                {comp.rating} ({comp.reviews} reviews)
                                            </span>
                                            <span>{comp.propertyType}</span>
                                            {comp.location.distance && (
                                                <span className="flex items-center">
                                                    <MapPin className="h-4 w-4 mr-1" />
                                                    {comp.location.distance}km away
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xl font-bold text-gray-900">${comp.price}</p>
                                        <p className={`text-sm ${comp.price > userListing.currentPrice ? 'text-red-600' : 'text-green-600'}`}>
                                            {comp.price > userListing.currentPrice ? '+' : ''}
                                            ${comp.price - userListing.currentPrice}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {pricingRecommendations.demandIndicators.length > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                        <h4 className="text-lg font-semibold text-green-900 mb-3">Market Demand Indicators</h4>
                        <ul className="space-y-2">
                            {pricingRecommendations.demandIndicators.map((indicator, idx) => (
                                <li key={idx} className="flex items-start space-x-2 text-green-800">
                                    <CheckCircle className="h-4 w-4 mt-0.5 text-green-600" />
                                    <span>{indicator}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        );
    };

    const FeatureRecommendations = () => {
        if (!analysis) return null;

        const { featureAnalysis } = analysis;

        return (
            <div className="space-y-6">
                <div className="bg-white border border-gray-200 rounded-lg">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h4 className="text-lg font-semibold text-gray-900">Missing Amenities Analysis</h4>
                        <p className="text-sm text-gray-600 mt-1">Based on real competitor data - what you're missing that could impact bookings</p>
                    </div>
                    <div className="p-6">
                        {featureAnalysis.missingAmenities.length > 0 ? (
                            <div className="space-y-4">
                                {featureAnalysis.missingAmenities.slice(0, 8).map((item, idx) => (
                                    <div key={idx} className="border border-gray-200 rounded-lg p-4">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center space-x-2">
                                                    <h5 className="font-semibold text-gray-900">{item.amenity}</h5>
                                                    <span className={`px-2 py-1 text-xs rounded-full ${item.prevalence >= 70 ? 'bg-red-100 text-red-800' :
                                                            item.prevalence >= 40 ? 'bg-yellow-100 text-yellow-800' :
                                                                'bg-green-100 text-green-800'
                                                        }`}>
                                                        {item.prevalence >= 70 ? 'High Priority' :
                                                            item.prevalence >= 40 ? 'Medium Priority' : 'Low Priority'}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                                            </div>
                                            <div className="text-right ml-4">
                                                <p className="text-lg font-bold text-gray-900">{item.prevalence}%</p>
                                                <p className="text-xs text-gray-600">of competitors</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-gray-600 text-center py-8">No significant amenity gaps found - you're well-equipped!</p>
                        )}
                    </div>
                </div>

                {featureAnalysis.uniqueAmenities.length > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                        <div className="flex items-start space-x-3">
                            <CheckCircle className="h-6 w-6 text-green-600 mt-1" />
                            <div>
                                <h4 className="text-lg font-semibold text-green-900">Your Unique Advantages</h4>
                                <p className="text-green-800 mt-1 mb-3">
                                    You have these amenities that most competitors don't offer:
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {featureAnalysis.uniqueAmenities.map((amenity, idx) => (
                                        <span key={idx} className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                                            {amenity}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="bg-white border border-gray-200 rounded-lg">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h4 className="text-lg font-semibold text-gray-900">Market Amenity Landscape</h4>
                        <p className="text-sm text-gray-600 mt-1">Most common amenities in your competitive set</p>
                    </div>
                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {featureAnalysis.competitorAmenities.slice(0, 10).map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <span className="font-medium text-gray-900">{item.amenity}</span>
                                    <div className="text-right">
                                        <span className="text-sm font-bold text-gray-900">{item.competitorPercentage}%</span>
                                        <p className="text-xs text-gray-600">{item.competitorCount} competitors</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const DescriptionOptimization = () => {
        if (!analysis) return null;

        const { descriptionAnalysis } = analysis;

        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-lg border border-gray-200">
                        <h4 className="text-lg font-semibold text-gray-900 mb-4">Current Description Score</h4>
                        <div className="flex items-center space-x-4">
                            <div className="flex-1 bg-gray-200 rounded-full h-3">
                                <div
                                    className="bg-yellow-500 h-3 rounded-full transition-all duration-500"
                                    style={{ width: `${(descriptionAnalysis.readabilityScore / 10) * 100}%` }}
                                ></div>
                            </div>
                            <span className="text-2xl font-bold text-yellow-600">{descriptionAnalysis.readabilityScore}/10</span>
                        </div>
                        <p className="text-sm text-gray-600 mt-2">Word count: {descriptionAnalysis.wordCount}</p>
                    </div>

                    <div className="bg-white p-6 rounded-lg border border-gray-200">
                        <h4 className="text-lg font-semibold text-gray-900 mb-4">Structure Analysis</h4>
                        <div className="space-y-2">
                            {Object.entries(descriptionAnalysis.structureAnalysis).map(([key, value]) => (
                                <div key={key} className="flex items-center space-x-2">
                                    {value ? (
                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                    ) : (
                                        <XCircle className="h-4 w-4 text-red-500" />
                                    )}
                                    <span className="text-sm text-gray-700 capitalize">
                                        {key.replace(/([A-Z])/g, ' $1').trim()}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {descriptionAnalysis.keywordAnalysis.missingKeywords.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-lg">
                        <div className="px-6 py-4 border-b border-gray-200">
                            <h4 className="text-lg font-semibold text-gray-900">Missing Keywords</h4>
                            <p className="text-sm text-gray-600 mt-1">Popular keywords from competitor descriptions</p>
                        </div>
                        <div className="p-6">
                            <div className="flex flex-wrap gap-2">
                                {descriptionAnalysis.keywordAnalysis.missingKeywords.slice(0, 15).map((keyword, idx) => (
                                    <span key={idx} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                                        {keyword}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                <div className="bg-white border border-gray-200 rounded-lg">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h4 className="text-lg font-semibold text-gray-900">AI Improvement Suggestions</h4>
                    </div>
                    <div className="p-6">
                        <div className="space-y-3">
                            {descriptionAnalysis.suggestions.map((suggestion, idx) => (
                                <div key={idx} className="flex items-start space-x-3">
                                    <div className="bg-green-100 rounded-full p-1 mt-1">
                                        <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                                    </div>
                                    <p className="text-gray-700">{suggestion}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {descriptionAnalysis.optimizedDescription && descriptionAnalysis.optimizedDescription !== descriptionAnalysis.currentDescription && (
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-6">
                        <h4 className="text-lg font-semibold text-purple-900 mb-3">AI-Optimized Description</h4>
                        <div className="bg-white rounded-lg p-4 border border-purple-200">
                            <p className="text-gray-800 leading-relaxed">{descriptionAnalysis.optimizedDescription}</p>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const AlertsInsights = () => {
        if (!analysis) return null;

        return (
            <div className="space-y-6">
                <div className="bg-white border border-gray-200 rounded-lg">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h4 className="text-lg font-semibold text-gray-900">Recent Market Activities</h4>
                        <p className="text-sm text-gray-600 mt-1">Real-time alerts based on competitor monitoring</p>
                    </div>
                    <div className="p-6">
                        {alerts.length > 0 ? (
                            <div className="space-y-4">
                                {alerts.map((alert, idx) => (
                                    <div key={idx} className={`border-l-4 pl-4 py-3 ${getImpactColor(alert.impact)}`}>
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <h5 className="font-medium">{alert.title}</h5>
                                                <p className="mt-1">{alert.message}</p>
                                                <p className="text-sm mt-1 opacity-75">
                                                    {new Date(alert.createdAt).toLocaleString()}
                                                </p>
                                            </div>
                                            <AlertCircle className={`h-5 w-5 ml-3 ${alert.impact === 'high' ? 'text-red-500' :
                                                    alert.impact === 'opportunity' ? 'text-green-500' :
                                                        alert.impact === 'medium' ? 'text-yellow-500' : 'text-blue-500'
                                                }`} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <Bell className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                                <p className="text-gray-600">No recent alerts for this listing</p>
                                <p className="text-sm text-gray-500 mt-1">Alerts will appear here when competitor activities are detected</p>
                            </div>
                        )}
                    </div>
                </div>

                {analysis.marketAnalysis.marketTrends.length > 0 && (
                    <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg p-6">
                        <div className="flex items-center space-x-3">
                            <BarChart3 className="h-6 w-6" />
                            <div>
                                <h4 className="text-lg font-semibold">Market Trends</h4>
                                <div className="mt-2 space-y-1">
                                    {analysis.marketAnalysis.marketTrends.map((trend, idx) => (
                                        <p key={idx} className="opacity-90">• {trend}</p>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white shadow-sm border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center space-x-3">
                            <div className="bg-blue-600 rounded-lg p-2">
                                <Home className="h-6 w-6 text-white" />
                            </div>
                            <h1 className="text-xl font-bold text-gray-900">AirBnB Competitive Intelligence</h1>
                        </div>
                        <div className="flex items-center space-x-4">
                            {analysis && (
                                <button
                                    onClick={refreshAnalysis}
                                    disabled={refreshing}
                                    className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                                >
                                    <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                                    <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
                                </button>
                            )}
                            <div className="text-sm text-gray-600">Real Data Version</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {!analysis ? (
                    /* Input Section */
                    <div className="max-w-2xl mx-auto">
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
                            <div className="text-center mb-8">
                                <h2 className="text-2xl font-bold text-gray-900 mb-2">Analyze Your Listing</h2>
                                <p className="text-gray-600">Enter your Airbnb listing ID to get real-time competitive insights</p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Airbnb Listing ID
                                    </label>
                                    <input
                                        type="text"
                                        value={listingId}
                                        onChange={(e) => setListingId(e.target.value)}
                                        placeholder="e.g., 12345678 (from airbnb.com/rooms/12345678)"
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>

                                {error && (
                                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                        <div className="flex items-center space-x-2">
                                            <XCircle className="h-5 w-5 text-red-500" />
                                            <span className="text-red-800 font-medium">Analysis Failed</span>
                                        </div>
                                        <p className="text-red-700 mt-1 text-sm">{error}</p>
                                    </div>
                                )}

                                <button
                                    onClick={analyzeListing}
                                    disabled={loading || !listingId.trim()}
                                    className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                                >
                                    {loading ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                            <span>Analyzing Real Data...</span>
                                        </>
                                    ) : (
                                        <>
                                            <BarChart3 className="h-4 w-4" />
                                            <span>Start Real Analysis</span>
                                        </>
                                    )}
                                </button>
                            </div>

                            <div className="mt-8 text-center text-sm text-gray-500">
                                <p>✨ This analyzes real competitor data using live Airbnb information</p>
                                <p className="mt-1">🔒 Completely safe and compliant data collection</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Results Section */
                    <div>
                        {/* Overview Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                            <div className="bg-white p-6 rounded-lg border border-gray-200">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-medium text-gray-500">Your Rating</h3>
                                    <Star className="h-4 w-4 text-yellow-500" />
                                </div>
                                <p className="text-2xl font-bold text-gray-900 mt-2">{analysis.userListing.rating || 'N/A'}</p>
                                <p className="text-sm text-gray-600">{analysis.userListing.reviews} reviews</p>
                            </div>

                            <div className="bg-white p-6 rounded-lg border border-gray-200">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-medium text-gray-500">Market Position</h3>
                                    <Calendar className="h-4 w-4 text-blue-500" />
                                </div>
                                <p className={`text-2xl font-bold mt-2 ${getMarketPositionColor(analysis.pricingRecommendations.currentMarketPosition)}`}>
                                    {getMarketPositionText(analysis.pricingRecommendations.currentMarketPosition)}
                                </p>
                                <p className="text-sm text-gray-600">vs {analysis.marketAnalysis.totalCompetitorsAnalyzed} competitors</p>
                            </div>

                            <div className="bg-white p-6 rounded-lg border border-gray-200">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-medium text-gray-500">Price vs Market</h3>
                                    <TrendingUp className="h-4 w-4 text-green-500" />
                                </div>
                                <p className="text-2xl font-bold text-gray-900 mt-2">
                                    {analysis.userListing.currentPrice ?
                                        `${Math.round(((analysis.userListing.currentPrice - analysis.marketAnalysis.averagePrice) / analysis.marketAnalysis.averagePrice) * 100)}%` :
                                        'N/A'
                                    }
                                </p>
                                <p className="text-sm text-gray-600">Difference from avg</p>
                            </div>

                            <div className="bg-white p-6 rounded-lg border border-gray-200">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-medium text-gray-500">Analysis Status</h3>
                                    {analysis.fromCache ? <Clock className="h-4 w-4 text-orange-500" /> : <CheckCircle className="h-4 w-4 text-green-500" />}
                                </div>
                                <p className="text-2xl font-bold text-gray-900 mt-2">
                                    {analysis.fromCache ? 'Cached' : 'Fresh'}
                                </p>
                                <p className="text-sm text-gray-600">
                                    {analysis.fromCache ? `${analysis.cacheAge}m old` : 'Just analyzed'}
                                </p>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="bg-white rounded-lg border border-gray-200">
                            <div className="border-b border-gray-200">
                                <nav className="flex space-x-8 px-6">
                                    {[
                                        { id: 'pricing', label: 'Pricing Optimization', icon: DollarSign },
                                        { id: 'features', label: 'Feature Analysis', icon: Lightbulb },
                                        { id: 'description', label: 'Description Optimization', icon: FileText },
                                        { id: 'alerts', label: 'Alerts & Insights', icon: Bell }
                                    ].map((tab) => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id)}
                                            className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${activeTab === tab.id
                                                    ? 'border-blue-500 text-blue-600'
                                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                                }`}
                                        >
                                            <tab.icon className="h-4 w-4" />
                                            <span>{tab.label}</span>
                                        </button>
                                    ))}
                                </nav>
                            </div>

                            <div className="p-6">
                                {activeTab === 'pricing' && <PricingOptimization />}
                                {activeTab === 'features' && <FeatureRecommendations />}
                                {activeTab === 'description' && <DescriptionOptimization />}
                                {activeTab === 'alerts' && <AlertsInsights />}
                            </div>
                        </div>

                        {/* Reset Button */}
                        <div className="mt-8 text-center">
                            <button
                                onClick={() => {
                                    setAnalysis(null);
                                    setAlerts([]);
                                    setListingId('');
                                    setActiveTab('pricing');
                                    setError(null);
                                }}
                                className="bg-gray-600 text-white py-2 px-6 rounded-lg font-medium hover:bg-gray-700"
                            >
                                Analyze Another Listing
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AirbnbCompetitiveAnalysisDemo;