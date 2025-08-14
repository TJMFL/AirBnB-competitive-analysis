import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import mongoose from 'mongoose';
import OpenAI from 'openai';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn, ChildProcess } from 'child_process';

// Database Models
const listingAnalysisSchema = new mongoose.Schema({
    listingId: { type: String, required: true, index: true },
    userListing: {
        id: String,
        name: String,
        currentPrice: Number,
        rating: Number,
        reviews: Number,
        amenities: [String],
        description: String,
        location: {
            city: String,
            neighborhood: String,
            coordinates: {
                lat: Number,
                lng: Number
            }
        },
        propertyType: String,
        hostInfo: {
            name: String,
            isSuperhost: Boolean,
            responseRate: String
        }
    },
    competitors: [{
        id: String,
        name: String,
        price: Number,
        rating: Number,
        reviews: Number,
        amenities: [String],
        description: String,
        location: {
            city: String,
            neighborhood: String,
            distance: Number
        },
        propertyType: String,
        availability: Boolean,
        lastUpdated: Date
    }],
    pricingRecommendations: {
        currentMarketPosition: String,
        suggestedPriceRange: {
            min: Number,
            max: Number,
            optimal: Number
        },
        reasoning: String,
        competitorComparison: String,
        demandIndicators: [String],
        seasonalInsights: String
    },
    featureAnalysis: {
        userAmenities: [String],
        competitorAmenities: [{
            amenity: String,
            competitorCount: Number,
            competitorPercentage: Number,
            competitorNames: [String]
        }],
        missingAmenities: [{
            amenity: String,
            prevalence: Number,
            description: String
        }],
        uniqueAmenities: [String]
    },
    descriptionAnalysis: {
        currentDescription: String,
        wordCount: Number,
        readabilityScore: Number,
        keywordAnalysis: {
            presentKeywords: [String],
            missingKeywords: [String],
            competitorKeywords: [String]
        },
        structureAnalysis: {
            hasIntro: Boolean,
            hasLocationInfo: Boolean,
            hasAmenityList: Boolean,
            hasBookingInfo: Boolean,
            hasCTA: Boolean
        },
        suggestions: [String],
        optimizedDescription: String
    },
    marketAnalysis: {
        totalCompetitorsAnalyzed: Number,
        averagePrice: Number,
        priceRange: {
            min: Number,
            max: Number
        },
        averageRating: Number,
        mostCommonAmenities: [{
            amenity: String,
            percentage: Number
        }],
        marketTrends: [String]
    },
    analyzedAt: { type: Date, default: Date.now },
    nextUpdateDue: Date,
    analysisVersion: { type: String, default: '2.0' }
});

const alertSchema = new mongoose.Schema({
    listingId: { type: String, required: true, index: true },
    type: {
        type: String,
        required: true,
        enum: ['price_change', 'new_competitor', 'amenity_update', 'rating_change', 'market_trend', 'availability_change']
    },
    title: String,
    message: String,
    impact: { type: String, enum: ['low', 'medium', 'high', 'opportunity'] },
    data: {
        competitorId: String,
        competitorName: String,
        oldValue: mongoose.Schema.Types.Mixed,
        newValue: mongoose.Schema.Types.Mixed,
        changePercentage: Number
    },
    createdAt: { type: Date, default: Date.now },
    isRead: { type: Boolean, default: false }
});

const competitorTrackingSchema = new mongoose.Schema({
    userListingId: String,
    competitorId: { type: String, required: true },
    competitorName: String,
    location: {
        city: String,
        neighborhood: String,
        distance: Number
    },
    priceHistory: [{
        price: Number,
        date: Date,
        checkin: String,
        checkout: String,
        guests: Number
    }],
    amenityHistory: [{
        amenities: [String],
        date: Date,
        changes: [String]
    }],
    ratingHistory: [{
        rating: Number,
        reviewCount: Number,
        date: Date
    }],
    availabilityHistory: [{
        isAvailable: Boolean,
        checkedDates: [String],
        date: Date
    }],
    lastUpdated: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true }
});

const ListingAnalysis = mongoose.model('ListingAnalysis', listingAnalysisSchema);
const Alert = mongoose.model('Alert', alertSchema);
const CompetitorTracking = mongoose.model('CompetitorTracking', competitorTrackingSchema);

class RealDataAirbnbBackend {
    private app: express.Application;
    private openai: OpenAI;
    private mcpClient: Client | null = null;
    private transport: StdioClientTransport | null = null;
    private serverProcess: ChildProcess | null = null;
    private isConnected: boolean = false;

    constructor() {
        this.app = express();
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY || ''
        });

        this.setupMiddleware();
        this.setupRoutes();
        this.setupScheduledJobs();
    }

    private setupMiddleware(): void {
        this.app.use(cors());
        this.app.use(express.json());

        // Request logging
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
            next();
        });
    }

    private setupRoutes(): void {
        // Health check
        this.app.get('/api/health', async (req, res) => {
            const mcpStatus = this.isConnected ? 'connected' : 'disconnected';
            res.json({
                status: 'healthy',
                mcp: mcpStatus,
                database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
                timestamp: new Date().toISOString()
            });
        });

        // Main analysis endpoint
        this.app.post('/api/analyze', async (req, res) => {
            try {
                const { listingId } = req.body;

                if (!listingId || typeof listingId !== 'string') {
                    return res.status(400).json({ error: 'Valid listing ID is required' });
                }

                console.log(`Starting analysis for listing: ${listingId}`);

                // Check if we have recent analysis (within 6 hours for real-time feel)
                const recentAnalysis = await ListingAnalysis.findOne({
                    listingId,
                    analyzedAt: { $gte: new Date(Date.now() - 6 * 60 * 60 * 1000) }
                });

                if (recentAnalysis) {
                    console.log(`Using cached analysis for ${listingId}`);
                    const alerts = await Alert.find({ listingId, isRead: false })
                        .sort({ createdAt: -1 })
                        .limit(10);

                    return res.json({
                        success: true,
                        data: recentAnalysis,
                        alerts,
                        fromCache: true,
                        cacheAge: Math.round((Date.now() - recentAnalysis.analyzedAt.getTime()) / (1000 * 60))
                    });
                }

                // Ensure MCP connection
                if (!this.isConnected) {
                    await this.initializeMCP();
                }

                // Perform new analysis with real data
                const analysis = await this.performRealAnalysis(listingId);

                // Save to database
                const savedAnalysis = await ListingAnalysis.findOneAndUpdate(
                    { listingId },
                    analysis,
                    { upsert: true, new: true }
                );

                // Get alerts
                const alerts = await Alert.find({ listingId, isRead: false })
                    .sort({ createdAt: -1 })
                    .limit(10);

                console.log(`Analysis completed for ${listingId}`);

                res.json({
                    success: true,
                    data: savedAnalysis,
                    alerts,
                    fromCache: false
                });

            } catch (error) {
                console.error('Analysis failed:', error);
                res.status(500).json({
                    error: 'Analysis failed',
                    details: error instanceof Error ? error.message : 'Unknown error',
                    listingId: req.body.listingId
                });
            }
        });

        // Get historical data
        this.app.get('/api/history/:listingId', async (req, res) => {
            try {
                const { listingId } = req.params;
                const { limit = 30 } = req.query;

                const history = await ListingAnalysis.find({ listingId })
                    .sort({ analyzedAt: -1 })
                    .limit(parseInt(limit as string));

                const competitorHistory = await CompetitorTracking.find({
                    userListingId: listingId,
                    isActive: true
                });

                res.json({
                    success: true,
                    analysisHistory: history,
                    competitorHistory,
                    totalAnalyses: history.length
                });

            } catch (error) {
                console.error('History fetch failed:', error);
                res.status(500).json({ error: 'Failed to fetch history' });
            }
        });

        // Get alerts
        this.app.get('/api/alerts/:listingId', async (req, res) => {
            try {
                const { listingId } = req.params;
                const { limit = 20, unreadOnly = false } = req.query;

                const query: any = { listingId };
                if (unreadOnly === 'true') {
                    query.isRead = false;
                }

                const alerts = await Alert.find(query)
                    .sort({ createdAt: -1 })
                    .limit(parseInt(limit as string));

                const unreadCount = await Alert.countDocuments({ listingId, isRead: false });

                res.json({
                    success: true,
                    alerts,
                    unreadCount,
                    totalCount: alerts.length
                });

            } catch (error) {
                res.status(500).json({ error: 'Failed to fetch alerts' });
            }
        });

        // Mark alerts as read
        this.app.post('/api/alerts/:listingId/mark-read', async (req, res) => {
            try {
                const { listingId } = req.params;
                const { alertIds } = req.body;

                const result = await Alert.updateMany(
                    { listingId, _id: { $in: alertIds } },
                    { isRead: true }
                );

                res.json({
                    success: true,
                    modifiedCount: result.modifiedCount
                });

            } catch (error) {
                res.status(500).json({ error: 'Failed to mark alerts as read' });
            }
        });

        // Force refresh analysis
        this.app.post('/api/refresh/:listingId', async (req, res) => {
            try {
                const { listingId } = req.params;

                console.log(`Force refreshing analysis for ${listingId}`);

                const analysis = await this.performRealAnalysis(listingId);

                const savedAnalysis = await ListingAnalysis.findOneAndUpdate(
                    { listingId },
                    analysis,
                    { upsert: true, new: true }
                );

                res.json({
                    success: true,
                    data: savedAnalysis,
                    refreshed: true
                });

            } catch (error) {
                console.error('Force refresh failed:', error);
                res.status(500).json({
                    error: 'Refresh failed',
                    details: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });
    }

    private async initializeMCP(): Promise<void> {
        try {
            console.log('Initializing MCP client...');

            // For Windows, let's use a more compatible approach
            const isWindows = process.platform === 'win32';

            if (isWindows) {
                // Windows-specific approach using cmd
                this.serverProcess = spawn('cmd', ['/c', 'npx', '-y', '@openbnb/mcp-server-airbnb', '--ignore-robots-txt'], {
                    stdio: ['pipe', 'pipe', 'pipe']
                });
            } else {
                this.serverProcess = spawn('npx', ['-y', '@openbnb/mcp-server-airbnb', '--ignore-robots-txt'], {
                    stdio: ['pipe', 'pipe', 'pipe']
                });
            }

            // Set up error handling for the process
            this.serverProcess.on('error', (error) => {
                console.error('MCP server process error:', error);
                this.isConnected = false;
            });

            this.serverProcess.stderr?.on('data', (data) => {
                console.error('MCP server stderr:', data.toString());
            });

            // Wait a moment for the server to start
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Create transport with Windows compatibility
            this.transport = new StdioClientTransport({
                command: isWindows ? 'cmd' : 'npx',
                args: isWindows
                    ? ['/c', 'npx', '-y', '@openbnb/mcp-server-airbnb', '--ignore-robots-txt']
                    : ['-y', '@openbnb/mcp-server-airbnb', '--ignore-robots-txt']
            });

            // Create client
            this.mcpClient = new Client(
                {
                    name: 'airbnb-real-data',
                    version: '2.0.0'
                }
            );

            // Connect to server
            await this.mcpClient.connect(this.transport);
            this.isConnected = true;

            console.log('✅ MCP client connected successfully');

            // Test connection by listing tools
            try {
                const tools = await this.mcpClient.listTools();
                console.log(`Available tools: ${tools.tools?.map(t => t.name).join(', ') || 'none'}`);
            } catch (error) {
                console.warn('Could not list tools:', error instanceof Error ? error.message : 'Unknown error');
            }

        } catch (error) {
            console.error('❌ MCP initialization failed:', error);
            this.isConnected = false;
            throw new Error(`MCP connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async performRealAnalysis(listingId: string): Promise<any> {
        console.log(`Starting real data analysis for listing ${listingId}`);

        if (!this.isConnected || !this.mcpClient) {
            throw new Error('MCP client not connected');
        }

        // Step 1: Get user listing details
        const userListing = await this.getRealUserListingDetails(listingId);
        console.log(`User listing data collected: ${userListing.name}`);

        // Step 2: Find real competitors
        const competitors = await this.findRealCompetitors(userListing);
        console.log(`Found ${competitors.length} real competitors`);

        // Step 3: Generate AI analysis
        const [pricingRecommendations, featureAnalysis, descriptionAnalysis] = await Promise.all([
            this.generateRealPricingRecommendations(userListing, competitors),
            this.generateRealFeatureAnalysis(userListing, competitors),
            this.generateRealDescriptionAnalysis(userListing, competitors)
        ]);

        // Step 4: Calculate market metrics
        const marketAnalysis = this.calculateRealMarketMetrics(competitors);

        const analysis = {
            listingId,
            userListing,
            competitors,
            pricingRecommendations,
            featureAnalysis,
            descriptionAnalysis,
            marketAnalysis,
            analyzedAt: new Date(),
            nextUpdateDue: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 hours
            analysisVersion: '2.0'
        };

        // Step 5: Track changes and generate alerts
        await this.trackRealChangesAndGenerateAlerts(listingId, analysis);

        return analysis;
    }

    private async getRealUserListingDetails(listingId: string): Promise<any> {
        if (!this.mcpClient) {
            throw new Error('MCP client not available');
        }

        try {
            console.log(`Fetching real data for listing ${listingId}`);

            const result = await this.mcpClient.callTool({
                name: 'airbnb_listing_details',
                arguments: {
                    id: listingId,
                    ignoreRobotsText: true  // Override robots.txt for competitive analysis
                }
            });

            if (!result.content || !Array.isArray(result.content) || result.content.length === 0) {
                throw new Error(`No data returned for listing ${listingId}`);
            }

            let data: any;
            try {
                const firstContent = result.content[0];
                const contentText = firstContent && typeof firstContent === 'object' && 'text' in firstContent
                    ? (firstContent as any).text
                    : JSON.stringify(firstContent);
                data = JSON.parse(contentText);

                // Debug: Log the actual structure we received
                console.log('MCP Response structure:', JSON.stringify(data, null, 2).substring(0, 1000) + '...');

            } catch (parseError) {
                console.error('Failed to parse MCP response:', result.content);
                throw new Error(`Invalid response format for listing ${listingId}`);
            }

            // Extract data from the details array structure
            const details = data.details || [];
            const locationDetail = details.find((d: any) => d.id === 'LOCATION_DEFAULT');
            const hostDetail = details.find((d: any) => d.id === 'HOST_DEFAULT');
            const amenitiesDetail = details.find((d: any) => d.id === 'AMENITIES_DEFAULT');
            const policiesDetail = details.find((d: any) => d.id === 'POLICIES_DEFAULT');

            // Extract title from various possible sources
            const title = data.title || data.name ||
                hostDetail?.title ||
                locationDetail?.title ||
                details[0]?.title ||
                'Airbnb Listing';

            // Extract location from LOCATION_DEFAULT section
            const lat = locationDetail?.lat || locationDetail?.latitude;
            const lng = locationDetail?.lng || locationDetail?.longitude || locationDetail?.lon;

            // Try to extract city/neighborhood from subtitle or other location fields
            let city = '';
            let neighborhood = '';

            if (locationDetail?.subtitle) {
                // Parse "Chicago, Illinois, United States" format
                const locationText = locationDetail.subtitle;
                const parts = locationText.split(',').map((p: string) => p.trim());
                if (parts.length >= 1) {
                    city = parts[0]; // "Chicago"
                    if (parts.length >= 2) {
                        // Could also extract state if needed
                    }
                }
            } else if (locationDetail?.locationDescription) {
                const locationText = locationDetail.locationDescription;
                const parts = locationText.split(',').map((p: string) => p.trim());
                if (parts.length >= 2) {
                    neighborhood = parts[0];
                    city = parts[1];
                } else {
                    city = parts[0];
                }
            }

            // Also try to extract neighborhood from the description if it mentions Wicker Park
            if (data.details) {
                const descDetail = data.details.find((d: any) => d.id === 'DESCRIPTION_DEFAULT');
                if (descDetail?.htmlDescription?.htmlText) {
                    const desc = descDetail.htmlDescription.htmlText;
                    // Look for neighborhood mentions
                    if (desc.includes('Wicker Park')) {
                        neighborhood = 'Wicker Park';
                    } else if (desc.includes('Bucktown')) {
                        neighborhood = 'Bucktown';
                    }
                }
            }

            console.log(`Extracted location: city="${city}", neighborhood="${neighborhood}", lat=${lat}, lng=${lng}`);

            if (!title) {
                console.log('Available data fields:', Object.keys(data));
                console.log('Details sections:', details.map((d: any) => d.id));
                console.warn(`No title found for listing ${listingId}, using default`);
            }

            return {
                id: listingId,
                name: title || `Listing ${listingId}`,
                currentPrice: this.extractPrice(data.pricing || data.price),
                rating: this.extractRating(data.rating || data.review_rating),
                reviews: this.extractReviewCount(data),
                amenities: this.extractAmenities(amenitiesDetail?.amenities || data.amenities),
                description: data.description || policiesDetail?.houseRulesSections || data.summary || '',
                location: {
                    city: city || 'Chicago', // Default to Chicago since we can see it's in Chicago
                    neighborhood: neighborhood || '',
                    coordinates: {
                        lat: lat || null,
                        lng: lng || null
                    }
                },
                propertyType: data.propertyType || data.roomType || data.listing_type || 'Unknown',
                hostInfo: {
                    name: hostDetail?.hostName || data.host?.name || '',
                    isSuperhost: hostDetail?.isSuperhost || data.host?.isSuperhost || false,
                    responseRate: hostDetail?.responseRate || data.host?.responseRate || ''
                }
            };
        } catch (error) {
            console.error(`Failed to fetch listing ${listingId}:`, error);
            throw new Error(`Unable to fetch listing data for ${listingId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async findRealCompetitors(userListing: any): Promise<any[]> {
        if (!this.mcpClient) {
            throw new Error('MCP client not available');
        }

        const competitors: any[] = [];
        const maxCompetitors = 8;
        let attempts = 0;
        const maxAttempts = 3;

        // Search in the same area - use actual location if available, fallback to Chicago
        const searchLocation = userListing.location.city || userListing.location.neighborhood || 'Chicago, IL';

        while (competitors.length < maxCompetitors && attempts < maxAttempts) {
            try {
                console.log(`Searching for competitors near ${searchLocation} (attempt ${attempts + 1})`);

                const searchResult = await this.mcpClient.callTool({
                    name: 'airbnb_search',
                    arguments: {
                        location: searchLocation,
                        adults: 2,
                        ignoreRobotsText: true  // Override robots.txt for competitive analysis
                    }
                });

                if (searchResult.content && Array.isArray(searchResult.content) && searchResult.content.length > 0) {
                    let searchData: any;
                    try {
                        const firstContent = searchResult.content[0];
                        const contentText = firstContent && typeof firstContent === 'object' && 'text' in firstContent
                            ? (firstContent as any).text
                            : JSON.stringify(firstContent);
                        searchData = JSON.parse(contentText);
                    } catch (parseError) {
                        console.error('Failed to parse search results:', searchResult.content);
                        attempts++;
                        continue;
                    }

                    if (searchData.listings && searchData.listings.length > 0) {
                        for (const listing of searchData.listings) {
                            // Skip the user's own listing
                            if (listing.id === userListing.id) continue;

                            // Skip if we already have this competitor
                            if (competitors.find(c => c.id === listing.id)) continue;

                            try {
                                // Get detailed data for this competitor
                                const detailResult = await this.mcpClient.callTool({
                                    name: 'airbnb_listing_details',
                                    arguments: {
                                        id: listing.id,
                                        ignoreRobotsText: true  // Override robots.txt for competitive analysis
                                    }
                                });

                                if (detailResult.content && Array.isArray(detailResult.content) && detailResult.content.length > 0) {
                                    let detailData: any;
                                    try {
                                        const firstContent = detailResult.content[0];
                                        const contentText = firstContent && typeof firstContent === 'object' && 'text' in firstContent
                                            ? (firstContent as any).text
                                            : JSON.stringify(firstContent);
                                        detailData = JSON.parse(contentText);
                                    } catch (parseError) {
                                        console.error(`Failed to parse details for ${listing.id}:`, detailResult.content);
                                        continue;
                                    }

                                    const competitor = {
                                        id: listing.id,
                                        name: detailData.title || listing.name || 'Competitor Listing',
                                        price: this.extractPrice(detailData.pricing || listing.pricing),
                                        rating: this.extractRating(detailData.rating || listing.rating),
                                        reviews: this.extractReviewCount(detailData) || listing.reviewCount || 0,
                                        amenities: this.extractAmenities(detailData.amenities),
                                        description: detailData.description || '',
                                        location: {
                                            city: detailData.location?.city || userListing.location.city,
                                            neighborhood: detailData.location?.neighborhood || '',
                                            distance: this.calculateDistance(userListing.location.coordinates, detailData.location)
                                        },
                                        propertyType: detailData.propertyType || detailData.roomType || 'Unknown',
                                        availability: true, // Assume available since it appeared in search
                                        lastUpdated: new Date()
                                    };

                                    // Only add if it has valid data
                                    if (competitor.price && competitor.price > 0) {
                                        competitors.push(competitor);
                                        console.log(`Added competitor: ${competitor.name} - $${competitor.price}`);
                                    }
                                }

                                // Rate limiting
                                await new Promise(resolve => setTimeout(resolve, 1500));

                            } catch (error) {
                                console.error(`Failed to get details for competitor ${listing.id}:`, error instanceof Error ? error.message : 'Unknown error');
                            }

                            // Stop if we have enough competitors
                            if (competitors.length >= maxCompetitors) break;
                        }
                    }
                }

                attempts++;

                // If we didn't find enough, try a broader search
                if (competitors.length < 3 && attempts < maxAttempts) {
                    console.log(`Only found ${competitors.length} competitors, trying broader search...`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }

            } catch (error) {
                console.error(`Competitor search attempt ${attempts + 1} failed:`, error instanceof Error ? error.message : 'Unknown error');
                attempts++;
            }
        }

        if (competitors.length === 0) {
            throw new Error(`No competitors found for location: ${searchLocation}`);
        }

        console.log(`Successfully found ${competitors.length} real competitors`);
        return competitors;
    }

    private async generateRealPricingRecommendations(userListing: any, competitors: any[]): Promise<any> {
        if (competitors.length === 0) {
            throw new Error('No competitors available for pricing analysis');
        }

        const competitorPrices = competitors.map(c => c.price).filter(p => p > 0);
        const averagePrice = competitorPrices.reduce((a, b) => a + b, 0) / competitorPrices.length;
        const currentPrice = userListing.currentPrice || 0;

        const prompt = `
    As an expert Airbnb pricing analyst, analyze this REAL competitive data and provide strategic pricing recommendations:

    USER LISTING:
    - Name: ${userListing.name}
    - Current Price: $${currentPrice}
    - Rating: ${userListing.rating}/5 (${userListing.reviews} reviews)
    - Property Type: ${userListing.propertyType}
    - Location: ${userListing.location.city}, ${userListing.location.neighborhood}

    REAL COMPETITORS (${competitors.length} listings analyzed):
    ${competitors.map(c => `- ${c.name}: $${c.price} (${c.rating}★, ${c.reviews} reviews, ${c.propertyType})`).join('\n')}

    MARKET DATA:
    - Average competitor price: $${Math.round(averagePrice)}
    - Price range: $${Math.min(...competitorPrices)} - $${Math.max(...competitorPrices)}
    - Your price vs market: ${currentPrice > 0 ? (currentPrice < averagePrice ? 'Below' : currentPrice > averagePrice ? 'Above' : 'At') + ' market average' : 'No current price data'}

    Provide detailed recommendations in this JSON format:
    {
      "currentMarketPosition": "below_market|at_market|above_market",
      "suggestedPriceRange": {
        "min": 120,
        "max": 160,
        "optimal": 140
      },
      "reasoning": "Detailed explanation of pricing strategy based on real competitor data",
      "competitorComparison": "Specific comparison with similar listings",
      "demandIndicators": ["indicator1", "indicator2"],
      "seasonalInsights": "Pricing insights based on market patterns"
    }
    `;

        try {
            const response = await this.openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' },
                temperature: 0.3
            });

            const recommendations = JSON.parse(response.choices[0].message.content || '{}');

            // Validate and add fallbacks
            return {
                currentMarketPosition: recommendations.currentMarketPosition ||
                    (currentPrice < averagePrice * 0.9 ? 'below_market' :
                        currentPrice > averagePrice * 1.1 ? 'above_market' : 'at_market'),
                suggestedPriceRange: recommendations.suggestedPriceRange || {
                    min: Math.round(averagePrice * 0.85),
                    max: Math.round(averagePrice * 1.15),
                    optimal: Math.round(averagePrice)
                },
                reasoning: recommendations.reasoning || `Based on analysis of ${competitors.length} similar listings in your area`,
                competitorComparison: recommendations.competitorComparison || `Your listing compares to ${competitors.length} nearby properties`,
                demandIndicators: recommendations.demandIndicators || ['Market analysis based on real competitor data'],
                seasonalInsights: recommendations.seasonalInsights || 'Monitor competitor pricing trends for seasonal adjustments'
            };
        } catch (error) {
            console.error('AI pricing analysis failed:', error);
            // Fallback to basic analysis
            return {
                currentMarketPosition: currentPrice < averagePrice ? 'below_market' : 'above_market',
                suggestedPriceRange: {
                    min: Math.round(averagePrice * 0.9),
                    max: Math.round(averagePrice * 1.1),
                    optimal: Math.round(averagePrice)
                },
                reasoning: `Based on analysis of ${competitors.length} real competitor listings`,
                competitorComparison: `Market average is $${Math.round(averagePrice)}`,
                demandIndicators: ['Real market data analysis'],
                seasonalInsights: 'Continue monitoring competitor pricing'
            };
        }
    }

    private async generateRealFeatureAnalysis(userListing: any, competitors: any[]): Promise<any> {
        const userAmenities = userListing.amenities || [];
        const allCompetitorAmenities = competitors.flatMap(c => c.amenities || []);

        // Count amenity frequency among competitors
        const amenityCount: Record<string, number> = {};
        allCompetitorAmenities.forEach((amenity: string) => {
            amenityCount[amenity] = (amenityCount[amenity] || 0) + 1;
        });

        // Find amenities user is missing
        const missingAmenities = Object.entries(amenityCount)
            .filter(([amenity]) => !userAmenities.includes(amenity))
            .map(([amenity, count]) => ({
                amenity,
                prevalence: Math.round((count / competitors.length) * 100),
                description: `${count} out of ${competitors.length} competitors offer this amenity`
            }))
            .sort((a, b) => b.prevalence - a.prevalence)
            .slice(0, 10);

        // Find unique amenities user has
        const uniqueAmenities = userAmenities.filter((amenity: string) =>
            !allCompetitorAmenities.includes(amenity)
        );

        // Categorize competitor amenities
        const competitorAmenities = Object.entries(amenityCount)
            .map(([amenity, count]) => ({
                amenity,
                competitorCount: count,
                competitorPercentage: Math.round((count / competitors.length) * 100),
                competitorNames: competitors
                    .filter(c => c.amenities?.includes(amenity))
                    .map(c => c.name)
                    .slice(0, 3) // Limit to 3 names
            }))
            .sort((a, b) => b.competitorCount - a.competitorCount);

        return {
            userAmenities,
            competitorAmenities,
            missingAmenities,
            uniqueAmenities
        };
    }

    private async generateRealDescriptionAnalysis(userListing: any, competitors: any[]): Promise<any> {
        const userDescription = userListing.description || '';
        const competitorDescriptions = competitors
            .map(c => c.description)
            .filter(desc => desc && desc.length > 50); // Only meaningful descriptions

        if (competitorDescriptions.length === 0) {
            return {
                currentDescription: userDescription,
                wordCount: userDescription.split(' ').length,
                readabilityScore: 7,
                keywordAnalysis: {
                    presentKeywords: [],
                    missingKeywords: [],
                    competitorKeywords: []
                },
                structureAnalysis: {
                    hasIntro: false,
                    hasLocationInfo: false,
                    hasAmenityList: false,
                    hasBookingInfo: false,
                    hasCTA: false
                },
                suggestions: ['No competitor descriptions available for analysis'],
                optimizedDescription: userDescription
            };
        }

        const prompt = `
    Analyze this Airbnb listing description against REAL competitor descriptions:

    USER DESCRIPTION:
    "${userDescription}"

    COMPETITOR DESCRIPTIONS (${competitorDescriptions.length} real listings):
    ${competitorDescriptions.map((desc, i) => `${i + 1}. "${desc.substring(0, 200)}..."`).join('\n\n')}

    Provide detailed analysis in JSON format:
    {
      "currentDescription": "${userDescription}",
      "wordCount": ${userDescription.split(' ').length},
      "readabilityScore": 8.5,
      "keywordAnalysis": {
        "presentKeywords": ["keyword1", "keyword2"],
        "missingKeywords": ["keyword3", "keyword4"],
        "competitorKeywords": ["popular", "keywords", "from", "competitors"]
      },
      "structureAnalysis": {
        "hasIntro": true,
        "hasLocationInfo": false,
        "hasAmenityList": true,
        "hasBookingInfo": false,
        "hasCTA": false
      },
      "suggestions": ["specific suggestion 1", "specific suggestion 2"],
      "optimizedDescription": "Improved description based on competitor analysis"
    }
    `;

        try {
            const response = await this.openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' },
                temperature: 0.4
            });

            return JSON.parse(response.choices[0].message.content || '{}');
        } catch (error) {
            console.error('Description analysis failed:', error);
            // Basic fallback analysis
            return {
                currentDescription: userDescription,
                wordCount: userDescription.split(' ').length,
                readabilityScore: 7,
                keywordAnalysis: {
                    presentKeywords: this.extractKeywords(userDescription),
                    missingKeywords: ['modern', 'downtown', 'walking distance'],
                    competitorKeywords: this.extractCompetitorKeywords(competitorDescriptions)
                },
                structureAnalysis: {
                    hasIntro: userDescription.length > 0,
                    hasLocationInfo: userDescription.toLowerCase().includes('location') || userDescription.toLowerCase().includes('downtown'),
                    hasAmenityList: userDescription.toLowerCase().includes('wifi') || userDescription.toLowerCase().includes('kitchen'),
                    hasBookingInfo: userDescription.toLowerCase().includes('book') || userDescription.toLowerCase().includes('stay'),
                    hasCTA: userDescription.toLowerCase().includes('contact') || userDescription.toLowerCase().includes('message')
                },
                suggestions: [
                    'Add more location-specific details based on competitor analysis',
                    'Include unique selling points that competitors mention',
                    'Improve description structure and readability'
                ],
                optimizedDescription: userDescription || 'Enhanced description needed'
            };
        }
    }

    private calculateRealMarketMetrics(competitors: any[]): any {
        if (competitors.length === 0) {
            return {
                totalCompetitorsAnalyzed: 0,
                averagePrice: 0,
                priceRange: { min: 0, max: 0 },
                averageRating: 0,
                mostCommonAmenities: [],
                marketTrends: ['Insufficient data for market analysis']
            };
        }

        const prices = competitors.map(c => c.price).filter(p => p > 0);
        const ratings = competitors.map(c => c.rating).filter(r => r > 0);
        const allAmenities = competitors.flatMap(c => c.amenities || []);

        // Count amenities
        const amenityCount: Record<string, number> = {};
        allAmenities.forEach((amenity: string) => {
            amenityCount[amenity] = (amenityCount[amenity] || 0) + 1;
        });

        const mostCommonAmenities = Object.entries(amenityCount)
            .map(([amenity, count]) => ({
                amenity,
                percentage: Math.round((count / competitors.length) * 100)
            }))
            .sort((a, b) => b.percentage - a.percentage)
            .slice(0, 10);

        // Generate market trends based on real data
        const marketTrends = [];
        const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
        const avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;

        if (avgPrice > 150) marketTrends.push('Premium pricing segment detected');
        if (avgRating > 4.5) marketTrends.push('High-quality listings dominate the area');
        if (mostCommonAmenities[0]?.percentage > 80) {
            marketTrends.push(`${mostCommonAmenities[0].amenity} is essential in this market`);
        }

        return {
            totalCompetitorsAnalyzed: competitors.length,
            averagePrice: Math.round(avgPrice),
            priceRange: {
                min: Math.min(...prices),
                max: Math.max(...prices)
            },
            averageRating: Math.round(avgRating * 10) / 10,
            mostCommonAmenities,
            marketTrends
        };
    }

    private async trackRealChangesAndGenerateAlerts(listingId: string, newAnalysis: any): Promise<void> {
        // Get previous analysis
        const prevAnalysis = await ListingAnalysis.findOne({
            listingId,
            analyzedAt: { $lt: newAnalysis.analyzedAt }
        }).sort({ analyzedAt: -1 });

        if (!prevAnalysis) {
            console.log(`No previous analysis found for ${listingId} - first time analysis`);
            return;
        }

        const alerts = [];

        // Track competitor price changes
        for (const newComp of newAnalysis.competitors) {
            const oldComp = prevAnalysis.competitors?.find((c: any) => c.id === newComp.id);
            if (oldComp && oldComp.price && Math.abs(oldComp.price - newComp.price) >= 5) {
                const change = newComp.price > oldComp.price ? 'increased' : 'decreased';
                const changePercent = Math.round(((newComp.price - oldComp.price) / oldComp.price) * 100);

                alerts.push({
                    listingId,
                    type: 'price_change',
                    title: 'Competitor Price Change',
                    message: `${newComp.name} ${change} price from ${oldComp.price} to ${newComp.price} (${changePercent > 0 ? '+' : ''}${changePercent}%)`,
                    impact: Math.abs(changePercent) > 15 ? 'high' : Math.abs(changePercent) > 8 ? 'medium' : 'low',
                    data: {
                        competitorId: newComp.id,
                        competitorName: newComp.name,
                        oldValue: oldComp.price,
                        newValue: newComp.price,
                        changePercentage: changePercent
                    }
                });
            }

            // Track rating changes
            if (oldComp && oldComp.rating && Math.abs(oldComp.rating - newComp.rating) >= 0.1) {
                const change = newComp.rating > oldComp.rating ? 'improved' : 'decreased';
                alerts.push({
                    listingId,
                    type: 'rating_change',
                    title: 'Competitor Rating Change',
                    message: `${newComp.name} rating ${change} from ${oldComp.rating} to ${newComp.rating}`,
                    impact: 'medium',
                    data: {
                        competitorId: newComp.id,
                        competitorName: newComp.name,
                        oldValue: oldComp.rating,
                        newValue: newComp.rating
                    }
                });
            }

            // Track new amenities
            const oldAmenities = oldComp?.amenities || [];
            const newAmenities = newComp.amenities || [];
            const addedAmenities = newAmenities.filter((a: string) => !oldAmenities.includes(a));

            if (addedAmenities.length > 0) {
                alerts.push({
                    listingId,
                    type: 'amenity_update',
                    title: 'Competitor Added Amenities',
                    message: `${newComp.name} added: ${addedAmenities.join(', ')}`,
                    impact: 'medium',
                    data: {
                        competitorId: newComp.id,
                        competitorName: newComp.name,
                        newValue: addedAmenities
                    }
                });
            }
        }

        // Check for new competitors
        const prevCompetitorIds = prevAnalysis.competitors?.map((c: any) => c.id) || [];
        const newCompetitors = newAnalysis.competitors.filter((c: any) => !prevCompetitorIds.includes(c.id));

        for (const newComp of newCompetitors) {
            alerts.push({
                listingId,
                type: 'new_competitor',
                title: 'New Competitor Detected',
                message: `New listing "${newComp.name}" appeared in your market at ${newComp.price}`,
                impact: 'medium',
                data: {
                    competitorId: newComp.id,
                    competitorName: newComp.name,
                    newValue: newComp.price
                }
            });
        }

        // Market trend alerts
        const prevAvgPrice = prevAnalysis.marketAnalysis?.averagePrice || 0;
        const currentAvgPrice = newAnalysis.marketAnalysis.averagePrice;

        if (Math.abs(currentAvgPrice - prevAvgPrice) > 10) {
            const trend = currentAvgPrice > prevAvgPrice ? 'increased' : 'decreased';
            const changePercent = Math.round(((currentAvgPrice - prevAvgPrice) / prevAvgPrice) * 100);

            alerts.push({
                listingId,
                type: 'market_trend',
                title: 'Market Price Trend',
                message: `Average market price ${trend} by ${Math.abs(changePercent)}% (from ${prevAvgPrice} to ${currentAvgPrice})`,
                impact: Math.abs(changePercent) > 20 ? 'high' : 'opportunity',
                data: {
                    oldValue: prevAvgPrice,
                    newValue: currentAvgPrice,
                    changePercentage: changePercent
                }
            });
        }

        // Save alerts
        if (alerts.length > 0) {
            await Alert.insertMany(alerts);
            console.log(`Generated ${alerts.length} alerts for ${listingId}`);
        }

        // Update competitor tracking
        for (const competitor of newAnalysis.competitors) {
            await CompetitorTracking.findOneAndUpdate(
                { userListingId: listingId, competitorId: competitor.id },
                {
                    $push: {
                        priceHistory: {
                            price: competitor.price,
                            date: new Date(),
                            checkin: this.getNextCheckinDate(),
                            checkout: this.getNextCheckoutDate(),
                            guests: 2
                        },
                        ratingHistory: {
                            rating: competitor.rating,
                            reviewCount: competitor.reviews,
                            date: new Date()
                        }
                    },
                    $set: {
                        competitorName: competitor.name,
                        location: competitor.location,
                        lastUpdated: new Date(),
                        isActive: true
                    }
                },
                { upsert: true }
            );
        }
    }

    private setupScheduledJobs(): void {
        // Update competitor data every 6 hours
        cron.schedule('0 */6 * * *', async () => {
            console.log('🕐 Running scheduled competitor analysis updates...');

            try {
                const listingsToUpdate = await ListingAnalysis.find({
                    nextUpdateDue: { $lte: new Date() }
                });

                console.log(`Found ${listingsToUpdate.length} listings to update`);

                for (const listing of listingsToUpdate) {
                    try {
                        console.log(`Updating ${listing.listingId}...`);
                        await this.performRealAnalysis(listing.listingId);
                        console.log(`✅ Updated ${listing.listingId}`);

                        // Rate limiting between listings
                        await new Promise(resolve => setTimeout(resolve, 5000));
                    } catch (error) {
                        console.error(`❌ Failed to update ${listing.listingId}:`, error instanceof Error ? error.message : 'Unknown error');
                    }
                }
            } catch (error) {
                console.error('Scheduled job failed:', error);
            }
        });

        // Cleanup old data daily at 2 AM
        cron.schedule('0 2 * * *', async () => {
            console.log('🧹 Running daily data cleanup...');

            try {
                // Mark old alerts as read (30 days)
                const oldAlerts = await Alert.updateMany(
                    {
                        createdAt: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
                        isRead: false
                    },
                    { isRead: true }
                );

                // Clean up old price history (keep last 100 entries per competitor)
                const trackings = await CompetitorTracking.find({});
                for (const tracking of trackings) {
                    if (tracking.priceHistory && tracking.priceHistory.length > 100) {
                        tracking.priceHistory = tracking.priceHistory
                            .sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0))
                            .slice(0, 100);
                        await tracking.save();
                    }
                }

                console.log(`Cleaned up ${oldAlerts.modifiedCount} old alerts and optimized tracking data`);
            } catch (error) {
                console.error('Cleanup job failed:', error);
            }
        });
    }

    // Utility functions
    private extractPrice(pricing: any): number {
        if (!pricing) return 0;
        if (typeof pricing === 'number') return pricing;
        if (typeof pricing === 'string') {
            const match = pricing.match(/\$?(\d+(?:,\d{3})*(?:\.\d{2})?)/);
            return match ? parseFloat(match[1].replace(/,/g, '')) : 0;
        }
        // Handle object pricing
        return pricing.total || pricing.base || pricing.night || pricing.amount || 0;
    }

    private extractRating(rating: any): number {
        if (!rating) return 0;
        if (typeof rating === 'number') return Math.min(5, Math.max(0, rating));
        if (typeof rating === 'string') {
            const match = rating.match(/(\d+\.?\d*)/);
            return match ? Math.min(5, Math.max(0, parseFloat(match[1]))) : 0;
        }
        return rating.overall || rating.average || rating.score || 0;
    }

    private extractReviewCount(data: any): number {
        return data.reviewCount || data.reviews || data.reviewsCount || data.numberOfReviews || 0;
    }

    private extractAmenities(amenities: any): string[] {
        if (!amenities) return [];
        if (Array.isArray(amenities)) return amenities.filter(a => typeof a === 'string');
        if (typeof amenities === 'string') return amenities.split(',').map(a => a.trim());
        return [];
    }

    private extractKeywords(text: string): string[] {
        if (!text) return [];
        const words = text.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 3);

        const commonWords = ['this', 'that', 'with', 'from', 'they', 'have', 'more', 'will', 'been', 'were', 'said', 'each', 'which', 'their', 'time', 'very', 'when', 'much', 'can', 'said', 'just', 'her', 'his', 'my', 'me', 'as', 'for', 'was', 'on', 'are', 'it', 'you', 'be', 'to', 'of', 'and', 'a', 'in', 'is', 'it', 'you', 'that', 'he', 'was', 'for', 'on', 'are', 'as', 'with', 'his', 'they', 'I', 'at', 'be', 'this', 'have', 'from', 'or', 'one', 'had', 'by', 'word', 'but', 'not', 'what', 'all', 'were', 'we', 'when', 'your', 'can', 'said', 'there', 'each', 'which', 'she', 'do', 'how', 'their', 'if', 'will', 'up', 'other', 'about', 'out', 'many', 'then', 'them', 'these', 'so', 'some', 'her', 'would', 'make', 'like', 'into', 'him', 'has', 'two', 'more'];

        return words.filter(word => !commonWords.includes(word))
            .slice(0, 10); // Top 10 keywords
    }

    private extractCompetitorKeywords(descriptions: string[]): string[] {
        const allWords = descriptions.join(' ').toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 3);

        const wordCount: Record<string, number> = {};
        allWords.forEach(word => {
            wordCount[word] = (wordCount[word] || 0) + 1;
        });

        return Object.entries(wordCount)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 15)
            .map(([word]) => word);
    }

    private calculateDistance(coords1: any, coords2: any): number {
        if (!coords1?.lat || !coords1?.lng || !coords2?.lat || !coords2?.lng) {
            return 0; // Unknown distance
        }

        const R = 6371; // Earth's radius in kilometers
        const dLat = (coords2.lat - coords1.lat) * Math.PI / 180;
        const dLon = (coords2.lng - coords1.lng) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(coords1.lat * Math.PI / 180) * Math.cos(coords2.lat * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return Math.round(R * c * 10) / 10; // Round to 1 decimal place
    }

    private getNextCheckinDate(): string {
        const date = new Date();
        date.setDate(date.getDate() + 7); // One week from now
        return date.toISOString().split('T')[0];
    }

    private getNextCheckoutDate(): string {
        const date = new Date();
        date.setDate(date.getDate() + 10); // 3-night stay
        return date.toISOString().split('T')[0];
    }

    async start(): Promise<void> {
        try {
            // Connect to MongoDB
            await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/airbnb-real-demo');
            console.log('✅ Connected to MongoDB');

            // Initialize MCP connection
            try {
                await this.initializeMCP();
            } catch (error) {
                console.warn('⚠️ MCP initialization failed, but server will continue without real data:', error instanceof Error ? error.message : 'Unknown error');
            }

            // Start Express server
            const port = process.env.PORT || 3001;
            this.app.listen(port, () => {
                console.log(`🚀 Real Data Airbnb Backend running on port ${port}`);
                console.log('📊 Available endpoints:');
                console.log('  POST /api/analyze - Analyze listing with real data');
                console.log('  GET  /api/history/:listingId - Get analysis history');
                console.log('  GET  /api/alerts/:listingId - Get alerts');
                console.log('  POST /api/refresh/:listingId - Force refresh analysis');
                console.log('  GET  /api/health - Health check');
                console.log('\n🎯 Ready to analyze real Airbnb listings!');
            });

        } catch (error) {
            console.error('❌ Failed to start backend:', error);
            process.exit(1);
        }
    }

    async cleanup(): Promise<void> {
        if (this.mcpClient) {
            try {
                await this.mcpClient.close();
            } catch (error) {
                console.error('Error closing MCP client:', error);
            }
        }

        if (this.serverProcess) {
            this.serverProcess.kill();
        }

        await mongoose.connection.close();
    }
}

// Start the application
if (require.main === module) {
    const backend = new RealDataAirbnbBackend();

    // Graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n🛑 Shutting down gracefully...');
        await backend.cleanup();
        process.exit(0);
    });

    backend.start().catch(console.error);
}

export default RealDataAirbnbBackend;