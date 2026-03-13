const FB_API_CONFIG = {
	edgeFunctionPath: '/functions/v1/publish-post',
	defaultPlatform: 'instagram',
	graphApiBaseUrl: 'https://graph.facebook.com/v22.0',
	graphApiToken: localStorage.getItem('graphApiToken') || 'EAAzvU5dynbMBQ5X1ZCC8CRtrZASthGA7QbFsdOgad3Sdn6dgO5sM99WV3DbkCzVYB7SM7Lk0TuxCzzKLYVx6BRiMutZAdHURDkw73ce9ZC0rHvWKGg7IdUsUoEzwhikYSNYuutjJS22DXJ3UdALaN9AQvww0Qqib0kGB6JQ9ZC905jUAkwolPjQ2FHyvFLetF',
	igUserId: localStorage.getItem('igUserId') || '3832773753519724',
	facebookPageId: localStorage.getItem('facebookPageId') || '',
	useEdgeFunction: false // Force direct API for stability
};

/**
 * Sets the Graph API token (updates both config and localStorage)
 */
function setGraphApiToken(token) {
	const cleanToken = (token || '').trim();
	FB_API_CONFIG.graphApiToken = cleanToken;
	localStorage.setItem('graphApiToken', cleanToken);
}

/**
 * Gets the current Graph API token
 */
function getGraphApiToken() {
	return FB_API_CONFIG.graphApiToken;
}

/**
 * Fetches Instagram Business Account ID from Graph API (with graceful fallback)
 */
async function resolveIgUserId() {
	if (FB_API_CONFIG.igUserId) return FB_API_CONFIG.igUserId;

	const graphToken = FB_API_CONFIG.graphApiToken;
	if (!graphToken) return null;

	try {
		const response = await fetch(
			`${FB_API_CONFIG.graphApiBaseUrl}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${encodeURIComponent(graphToken)}`
		);
		const data = await response.json();

		if (!response.ok) {
			throw new Error(data?.error?.message || 'Could not fetch page/account mapping');
		}

		const pages = data?.data || [];
		const firstWithIg = pages.find((page) => page?.instagram_business_account?.id);
		if (!firstWithIg) {
			throw new Error('No connected Instagram Business Account found. Connect Instagram to your Facebook Page first.');
		}

		const resolvedId = firstWithIg.instagram_business_account.id;
		FB_API_CONFIG.igUserId = resolvedId;
		localStorage.setItem('igUserId', resolvedId);
		return resolvedId;
	} catch (error) {
		console.warn('Failed to resolve IG account ID:', error.message);
		return null;
	}
}

/**
 * Test token and auto-resolve correct IG User ID with improved error detection and fallback strategy
 * 1. First validates the token by calling /me
 * 2. Then fetches all Facebook Pages and their connected Instagram Business Accounts
 * 3. If that fails or returns no IG accounts, tries /me/instagram_accounts as fallback
 * 4. Provides specific error messages for permission/scope issues
 */
async function testTokenAndResolveIgId() {
	const graphToken = FB_API_CONFIG.graphApiToken;
	if (!graphToken || graphToken.length < 50) {
		throw new Error('Token missing or too short. Paste a fresh token from Meta App Dashboard.');
	}

	// Step 1: Validate token by fetching /me
	let meData;
	try {
		const meRes = await fetch(
			`${FB_API_CONFIG.graphApiBaseUrl}/me?fields=id,name,verified&access_token=${encodeURIComponent(graphToken)}`,
			{ method: 'GET' }
		);
		meData = await meRes.json();

		if (!meRes.ok) {
			const error = meData?.error;
			if (error?.code === 190 || error?.message?.includes('Invalid OAuth')) {
				throw new Error('Token is expired or invalid. Generate a fresh token from: https://developers.facebook.com/tools/accesstoken/');
			}
			throw new Error(error?.message || 'Token validation failed');
		}
	} catch (error) {
		throw new Error(`Token Invalid: ${error.message}`);
	}

	// Step 2: Fetch Facebook Pages and connected Instagram Business Accounts
	// This is the CORRECT and RELIABLE approach (not /me/instagram_accounts)
	let accountsData;
	try {
		const accountsUrl = `${FB_API_CONFIG.graphApiBaseUrl}/me/accounts?fields=id,name,category,access_token,instagram_business_account{id,username,name}&access_token=${encodeURIComponent(graphToken)}`;
		const accountsRes = await fetch(accountsUrl, { method: 'GET' });
		accountsData = await accountsRes.json();

		if (!accountsRes.ok) {
			const error = accountsData?.error;
			if (error?.code === 200 || error?.message?.includes('permissions')) {
				throw new Error('Missing permission: pages_show_list. Re-generate token with pages_show_list + pages_read_engagement permissions.');
			}
			throw new Error(error?.message || 'Failed to fetch pages');
		}
	} catch (error) {
		throw new Error(`Pages Fetch Error: ${error.message}`);
	}

	const pages = accountsData?.data || [];

	// Step 3: Look for a page with a connected Instagram Business Account
	const pageWithIg = pages.find((page) => page?.instagram_business_account?.id);

	if (pageWithIg?.instagram_business_account?.id) {
		const correctIgId = pageWithIg.instagram_business_account.id;
		const igUsername = pageWithIg.instagram_business_account.username || pageWithIg.instagram_business_account.name || correctIgId;
		setIgUserId(correctIgId);
		if (pageWithIg.id) localStorage.setItem('facebookPageId', pageWithIg.id);

		return {
			valid: true,
			message: `✓ Success! Found Instagram Business Account: "${igUsername}" (ID: ${correctIgId}) linked to Facebook Page: "${pageWithIg.name}"`,
			igUserId: correctIgId,
			pageName: pageWithIg.name,
			pageId: pageWithIg.id,
		};
	}

	// Step 4: If no IG account found via /me/accounts, provide detailed diagnostic info
	if (pages.length > 0) {
		// User has pages but none have an IG account connected
		const pageNames = pages.map(p => `"${p.name}" (${p.id})`).join(', ');
		throw new Error(
			`No Instagram Business Account found linked to your pages: ${pageNames}. ` +
			`Solution: Go to Instagram Settings > Linked Accounts > Facebook, confirm/link your Facebook Page, then regenerate token.`
		);
	}

	// Step 5: Last resort - try /me/instagram_accounts (works only for Creator/Pro accounts with correct scopes)
	try {
		const meIgUrl = `${FB_API_CONFIG.graphApiBaseUrl}/me/instagram_accounts?fields=id,username,name&access_token=${encodeURIComponent(graphToken)}`;
		const meIgRes = await fetch(meIgUrl, { method: 'GET' });
		const meIgData = await meIgRes.json();

		if (meIgRes.ok && meIgData?.data?.length > 0) {
			const firstIg = meIgData.data[0];
			const correctIgId = firstIg.id;
			setIgUserId(correctIgId);
			return {
				valid: true,
				message: `✓ Found via alternative method: "${firstIg.username || firstIg.name || correctIgId}" (ID: ${correctIgId}). ` +
					`Note: This is a Creator/Personal account. For best results, connect it to a Facebook Business Page.`,
				igUserId: correctIgId,
				isCreatorAccount: true,
			};
		}
	} catch (error) {
		console.warn('Fallback /me/instagram_accounts also failed:', error.message);
	}

	// Step 6: Inform user about required setup
	throw new Error(
		`No Instagram Business Account found. Required setup:\n` +
		`1. Your Instagram account must be a Business or Creator account (not Personal)\n` +
		`2. Link Instagram → Settings → Linked Accounts → Facebook Page\n` +
		`3. In Meta App, grant token permissions for Instagram account (not just Page)\n` +
		`4. Generate a fresh token, paste it here, and test again`
	);
}


async function getPublishingContext() {
	const graphToken = FB_API_CONFIG.graphApiToken;
	if (!graphToken || graphToken.length < 50) {
		throw new Error('Graph API token missing/invalid. Paste a fresh token in Settings.');
	}

	const response = await fetch(
		`${FB_API_CONFIG.graphApiBaseUrl}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${encodeURIComponent(graphToken)}`
	);
	const data = await response.json();

	if (!response.ok) {
		throw new Error(data?.error?.message || 'Failed to load Facebook pages from token');
	}

	const pages = data?.data || [];
	const pageWithIg = pages.find((page) => page?.instagram_business_account?.id && page?.access_token);
	if (!pageWithIg) {
		if (FB_API_CONFIG.igUserId) {
			return {
				igUserId: FB_API_CONFIG.igUserId,
				pageAccessToken: graphToken,
				pageId: null,
				pageName: null,
				fromManualFallback: true,
			};
		}
		throw new Error('No Facebook Page with connected Instagram Business Account found for this token, and no fallback IG User ID is set. In Settings, save your Instagram Business Account ID then try again.');
	}

	const resolvedIgId = pageWithIg.instagram_business_account.id;
	FB_API_CONFIG.igUserId = resolvedIgId;
	localStorage.setItem('igUserId', resolvedIgId);

	return {
		igUserId: resolvedIgId,
		pageAccessToken: pageWithIg.access_token,
		pageId: pageWithIg.id,
		pageName: pageWithIg.name,
		fromManualFallback: false,
	};
}

/**
 * Set IG User ID manually
 */
function setIgUserId(userId) {
	FB_API_CONFIG.igUserId = userId;
	localStorage.setItem('igUserId', userId);
}

/**
 * Get IG User ID with fallback
 */
function getIgUserId() {
	return FB_API_CONFIG.igUserId;
}

/**
 * Set Facebook Page ID manually
 */
function setFacebookPageId(pageId) {
	FB_API_CONFIG.facebookPageId = pageId;
	localStorage.setItem('facebookPageId', pageId);
}

/**
 * Get Facebook Page ID
 */
function getFacebookPageId() {
	return FB_API_CONFIG.facebookPageId;
}

/**
 * Helper function to extract meaningful error info from Graph API error responses
 */
function getDetailedGraphError(errorData, defaultMsg) {
	const error = errorData?.error;
	if (!error) return defaultMsg;

	const msg = error.message || '';
	const code = error.code;
	const subcode = error.error_subcode;

	console.error('Full Graph API Error Details:', {
		message: msg,
		code: code,
		subcode: subcode,
		type: error.type,
		fbtrace_id: error.fbtrace_id
	});

	// Check for image related errors
	if (code === 9004 || msg.includes('media type') || msg.includes('Only photo or video')) {
		return `Instagram Rejected Image (9004):\n` +
			`1. Aspect Ratio: Ensure image is between 4:5 and 1.91:1. Use 'Adjust Image' to fix.\n` +
			`2. Hosting: Facebook may be blocking your image host (e.g. imgBB). Use 'Adjust Image' to move it to Supabase.\n` +
			`3. Image size: Ensure it is less than 8MB.`;
	}
	if (msg.includes('image_url') || msg.includes('URL is invalid') || msg.includes('accessible')) {
		return `Image error: Instagram cannot access the image URL.\n` +
			`Detail: ${msg}\n\n` +
			`Solution: Ensure the URL is public. Use 'Adjust Image' to move it to Supabase Storage for better compatibility.`;
	}
	if (msg.includes('400') || msg.includes('Bad Request')) {
		return `Bad Request (400): The data sent to Instagram was rejected.\n` +
			`Message: ${msg}\n` +
			`Common fixes: Use the 'Adjust Image' button to re-process the image through Supabase.`;
	}
	if (msg.includes('Image URL is invalid')) {
		return `Invalid image URL. Make sure:\n` +
			`1. URL starts with http:// or https://\n` +
			`2. Image is public (test in Incognito window)\n` +
			`3. Image format is JPEG or PNG\n` +
			`4. Image size is less than 8MB`;
	}
	if (msg.includes('Unsupported post request') || msg.includes('Object with ID')) {
		return `Invalid IG Business Account ID. Ensure it matches your token's Instagram account.`;
	}
	if (msg.includes('permissions error') || code === 200 || subcode === 2207052) {
		return `Permission error: Re-generate token with instagram_basic, instagram_content_publish, pages_show_list, pages_read_engagement permissions.`;
	}
	if (msg.includes('Cannot parse access token') || msg.includes('Invalid OAuth')) {
		return `Token expired or invalid. Regenerate from: https://developers.facebook.com/tools/accesstoken/`;
	}
	if (msg.includes('is not available') || msg.includes('not linked')) {
		return `Account connection issue: Ensure Instagram is linked to Facebook Page and connection is confirmed.`;
	}
	if (msg.includes('is not a') || msg.includes('not a member')) {
		return `Account type issue: Instagram must be a Business or Creator account (not Personal).`;
	}

	return msg || defaultMsg;
}

/**
 * Validate image URL for Instagram compatibility
 * Checks: accessibility, format, size, and aspect ratio
 */
async function validateImageUrl(imageUrl) {
	if (!imageUrl || typeof imageUrl !== 'string') {
		throw new Error('Image URL is required and must be a string.');
	}

	// ✓ Auto-fix common ImgBB typo: i.ibb.co.com -> i.ibb.co
	if (imageUrl.includes('i.ibb.co.com')) {
		console.warn('⚠️ Correcting ImgBB typo: i.ibb.co.com -> i.ibb.co');
		imageUrl = imageUrl.replace('i.ibb.co.com', 'i.ibb.co');
	}

	let parsedUrl;
	try {
		parsedUrl = new URL(imageUrl);
	} catch (error) {
		throw new Error(`❌ Invalid URL format: ${imageUrl}`);
	}

	// ✓ Check 1: URL must be publicly accessible (not localhost or file path)
	if (imageUrl.includes('localhost') || imageUrl.includes('127.0.0.1') || imageUrl.includes('file://') || imageUrl.startsWith('C:') || imageUrl.startsWith('/')) {
		throw new Error(
			`❌ Image URL must be publicly accessible on the internet. ` +
			`Your URL looks like a local file/localhost.\n` +
			`Solutions:\n` +
			`1. Use imgBB (recommended - always public)\n` +
			`2. Upload to Cloudinary or Imgur\n` +
			`3. Use a publicly accessible image URL (starts with http:// or https://)`
		);
	}

	// ✓ Check 2: URL must be absolute HTTP/HTTPS
	if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
		throw new Error(
			`❌ Image URL must start with http:// or https://\n` +
			`Your URL: ${imageUrl}`
		);
	}

	// ✓ Check 3: Host rules for ImgBB and known services
	const host = parsedUrl.hostname.toLowerCase();
	const safeServices = ['i.ibb.co', 'imgbb.com', 'imgur.com', 'i.imgur.com', 'cloudinary.com', 'res.cloudinary.com', 'images.unsplash.com'];
	const isFromSafeService = safeServices.some(service => host === service || host.endsWith(`.${service}`));

	if (host === 'ibb.co') {
		throw new Error(
			`❌ This is an imgBB viewer URL (${imageUrl}), not a direct image URL.\n` +
			`Please copy the direct link from imgBB (must start with https://i.ibb.co/ and end with .jpg/.jpeg/.png).`
		);
	}

	if (isFromSafeService) {
		console.log(`✓ Image from safe service detected: ${host}`);
	}

	// ✓ Check 4: For other URLs, verify accessibility by HEAD request
	try {
		const headRes = await fetch(imageUrl, { method: 'HEAD' });
		if (!headRes.ok && headRes.status !== 405) { // 405=Method Not Allowed is ok for HEAD
			throw new Error(`Image URL returned status ${headRes.status}`);
		}
	} catch (error) {
		throw new Error(
			`❌ Cannot access image URL. Verify it's publicly accessible:\n` +
			`${imageUrl}\n` +
			`Test: Open this URL in an Incognito window - if it doesn't load, Instagram API can't access it either.\n` +
			`Error: ${error.message}`
		);
	}

	// ✓ Check 5: File format must be JPEG or PNG
	const pathLower = parsedUrl.pathname.toLowerCase();
	const isSupportedExt = /\.(jpg|jpeg|png)$/.test(pathLower);
	if (!isSupportedExt) {
		throw new Error(
			`❌ Image format must be JPEG or PNG.` +
			`Supported: .jpg, .jpeg, .png\n` +
			`Your URL: ${imageUrl}`
		);
	}

	// ✓ Check 6: Deep validation for Aspect Ratio and Dimensions
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = "Anonymous";

		const timeout = setTimeout(() => {
			console.warn('Image dimension check timed out. Proceeding...');
			resolve(imageUrl);
		}, 5000);

		img.onload = () => {
			clearTimeout(timeout);
			const ratio = img.width / img.height;
			console.log(`Image dimensions: ${img.width}x${img.height}, Ratio: ${ratio.toFixed(2)}`);

			// Instagram strict: 4:5 (0.8) to 1.91:1. Using 0.79 tolerance for safety
			if (ratio < 0.79 || ratio > 1.92) {
				reject(new Error(
					`❌ Aspect Ratio Error: ${img.width}x${img.height} (Ratio: ${ratio.toFixed(2)}).\n` +
					`Instagram requires between 0.8 (4:5) and 1.91 (1.91:1).`
				));
			} else {
				resolve(imageUrl);
			}
		};

		img.onerror = () => {
			clearTimeout(timeout);
			console.warn('CORS/Load error on dimension check. Proceeding...');
			resolve(imageUrl);
		};

		img.src = imageUrl;
	});
}

async function publishDirectToInstagram({ imageUrl, caption }) {
	const ctx = await getPublishingContext();
	const igUserId = ctx.igUserId;
	const publishToken = ctx.pageAccessToken;

	try {
		// ✓ Validate image and get cleaned URL
		const validatedUrl = await validateImageUrl(imageUrl);

		// 🛡️ NO CACHE BUSTER: Parameters like ?cb= can confuse some Meta crawler versions
		// We rely on unique filenames from autoFixPostImage instead of URL params.
		const cleanUrl = validatedUrl.split('?')[0];

		// 🧼 Sanitize Caption
		const cleanCaption = (caption || 'Posted via Gopal\'s Diary').trim()
			.replace(/[\{\}\[\]]/g, '')
			.replace(/\s+/g, ' ');

		console.log('Publishing to IG (Direct API):', { igUserId, imageUrl: cleanUrl });

		// Step 1: Create media container using Query Parameters (Highly compatible for v25.0)
		const createParams = new URLSearchParams({
			image_url: cleanUrl,
			caption: cleanCaption,
			access_token: publishToken,
		});

		const createUrl = `${FB_API_CONFIG.graphApiBaseUrl}/${igUserId}/media?${createParams.toString()}`;
		const createRes = await fetch(createUrl, { method: 'POST' });

		const createData = await createRes.json();
		if (!createRes.ok) {
			const detailedError = getDetailedGraphError(createData, 'Failed to create media');
			throw new Error(detailedError);
		}

		const creationId = createData.id;
		console.log('✓ Media container created:', creationId);

		// Step 2: Publish container
		const publishParams = new URLSearchParams({
			creation_id: creationId,
			access_token: publishToken,
		});

		const publishUrl = `${FB_API_CONFIG.graphApiBaseUrl}/${igUserId}/media_publish?${publishParams.toString()}`;
		const publishRes = await fetch(publishUrl, { method: 'POST' });

		const publishData = await publishRes.json();
		if (!publishRes.ok) {
			const detailedError = getDetailedGraphError(publishData, 'Failed to publish media');
			throw new Error(detailedError);
		}

		return { success: true, id: publishData.id };
	} catch (error) {
		console.error('Publishing Failure:', error.message);
		throw new Error(error.message);
	}
}

/**
 * Publishes a post via Edge Function with direct API fallback
 */
async function publishPost({ platform, imageUrl, caption }) {
	const session = supabase.getSession();
	const accessToken = session?.access_token;

	if (!accessToken) {
		throw new Error('Authentication required. Please login first.');
	}

	const targetPlatform = platform || FB_API_CONFIG.defaultPlatform;
	const functionUrl = `${SUPABASE_URL}${FB_API_CONFIG.edgeFunctionPath}`;

	if (!imageUrl) {
		throw new Error('Image URL is required for publishing.');
	}

	if (FB_API_CONFIG.useEdgeFunction) {
		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 5000);

			const response = await fetch(functionUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${accessToken}`,
					'apikey': SUPABASE_ANON_KEY
				},
				body: JSON.stringify({
					platform: targetPlatform,
					imageUrl,
					caption
				}),
				signal: controller.signal
			});

			clearTimeout(timeoutId);

			let data = null;
			try {
				data = await response.json();
			} catch (error) {
				data = null;
			}

			if (response.ok) return data;
			console.warn('Edge Function error:', response.status, data?.error || data?.message);
		} catch (error) {
			console.warn('Edge Function unavailable, falling back to direct Graph API:', error.message);
		}
	}

	// Fallback: Direct Instagram Graph API
	if (targetPlatform === 'instagram') {
		return await publishDirectToInstagram({ imageUrl, caption });
	}

	throw new Error('Publishing failed. Please try again.');
}

/**
 * Saves a post to Supabase for later publishing
 */
async function saveToDatabase({ imageUrl, caption, platform, post_section }) {
	return await supabase.request('scheduled_posts', 'POST', {
		image_url: imageUrl,
		caption: caption,
		platform: platform || 'instagram',
		status: 'pending',
		post_section: post_section || 'other'
	});
}

/**
 * Updates a saved post status
 */
async function updatePostStatus(postId, update = {}) {
	return await supabase.request(`scheduled_posts?id=eq.${postId}`, 'PATCH', update);
}

/**
 * Deletes a post from DB
 */
async function deletePost(postId) {
	return await supabase.request(`scheduled_posts?id=eq.${postId}`, 'DELETE');
}

/**
 * Fetches pending posts from DB
 */
async function getPendingPosts() {
	return await supabase.request('scheduled_posts?status=eq.pending&order=created_at.desc', 'GET');
}

/**
 * Loads posts from database with optional filters
 */
async function loadFromDatabase(filters = {}) {
	let query = 'scheduled_posts';
	const conditions = [];

	if (filters.status) conditions.push(`status=eq.${filters.status}`);
	if (filters.id) conditions.push(`id=eq.${filters.id}`);
	if (filters.platform) conditions.push(`platform=eq.${filters.platform}`);
	if (filters.post_section && filters.post_section !== 'all') {
		conditions.push(`post_section=eq.${filters.post_section}`);
	}

	// Always sort by post_sl descending (newest first)
	let queryString = conditions.length > 0 ? '?' + conditions.join('&') : '';
	
	if (queryString) {
		queryString += '&order=post_sl.desc';
	} else {
		queryString = '?order=post_sl.desc';
	}

	return await supabase.request(query + queryString, 'GET');
}

/**
 * Compresses a base64 image to meet size requirements (target ~190KB)
 */
async function compressBase64Image(base64Data, targetSizeKB = 190, toleranceKB = 10) {
	return new Promise((resolve) => {
		const img = new Image();
		img.src = base64Data;
		img.onload = () => {
			const canvas = document.createElement('canvas');
			canvas.width = img.width;
			canvas.height = img.height;
			const ctx = canvas.getContext('2d');
			ctx.drawImage(img, 0, 0);

			let quality = 0.95;
			let resultData = base64Data;
			let currentSizeKB = (resultData.length * 3 / 4) / 1024;

			console.log(`Initial size: ${currentSizeKB.toFixed(2)}KB`);

			if (currentSizeKB <= targetSizeKB + toleranceKB) {
				console.log('Image already within target size.');
				resolve(base64Data);
				return;
			}

			// Iterative compression
			while (currentSizeKB > targetSizeKB + toleranceKB && quality > 0.1) {
				resultData = canvas.toDataURL('image/jpeg', quality);
				currentSizeKB = (resultData.length * 3 / 4) / 1024;
				quality -= 0.05;
			}

			console.log(`Compressed size: ${currentSizeKB.toFixed(2)}KB (Quality: ${quality.toFixed(2)})`);
			resolve(resultData);
		};
		img.onerror = () => resolve(base64Data); // Fallback to original
	});
}

/**
 * Uploads a base64 image to Supabase Storage bucket 'insta_post_bucket'
 */
async function uploadToSupabaseStorage(base64Data, fileName) {
	const session = supabase.getSession();
	const token = session?.access_token || SUPABASE_ANON_KEY;
	
	// Convert base64 to Blob
	const base64Content = base64Data.split(',')[1];
	const byteCharacters = atob(base64Content);
	const byteNumbers = new Array(byteCharacters.length);
	for (let i = 0; i < byteCharacters.length; i++) {
		byteNumbers[i] = byteCharacters.charCodeAt(i);
	}
	const byteArray = new Uint8Array(byteNumbers);
	const blob = new Blob([byteArray], { type: 'image/jpeg' });

	const bucketName = 'insta_post_bucket';
	const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${bucketName}/${fileName}`;

	const response = await fetch(uploadUrl, {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${token}`,
			'apikey': SUPABASE_ANON_KEY,
			'Content-Type': 'image/jpeg',
			'x-upsert': 'true'
		},
		body: blob
	});

	if (!response.ok) {
		const err = await response.json();
		throw new Error(`Storage Upload Failed: ${err.message || response.statusText}`);
	}

	// Construct public URL
	return `${SUPABASE_URL}/storage/v1/object/public/${bucketName}/${fileName}`;
}

/**
 * Uploads a base64 image (manual crop) to Supabase Storage and updates database
 */
async function uploadBase64AndStore(postId, base64Data) {
	try {
		console.log('🔄 Starting image compression and upload process...');
		
		// 1. Compress image to target size (~190KB)
		const compressedBase64 = await compressBase64Image(base64Data, 190, 5);
		
		// 2. Upload to Supabase Storage
		const fileName = `manual_crop_${postId}_${Date.now()}.jpg`;
		const newUrl = await uploadToSupabaseStorage(compressedBase64, fileName);

		console.log('✅ Uploaded to Supabase Storage:', newUrl);

		// 3. Update Supabase Database
		await updatePostStatus(postId, { image_url: newUrl });

		// Propagation delay for Meta crawler
		console.log('⏳ Waiting 10 seconds for crawler propagation...');
		await new Promise(r => setTimeout(r, 10000));

		return newUrl;
	} catch (error) {
		console.error('❌ Upload/Store Failed:', error.message);
		throw error;
	}
}

window.FBApi = {
	publishPost,
	publishDirectToInstagram,
	validateImageUrl,
	resolveIgUserId,
	setIgUserId,
	getIgUserId,
	setGraphApiToken,
	getGraphApiToken,
	getPublishingContext,
	testTokenAndResolveIgId,
	saveToDatabase,
	getPendingPosts,
	loadFromDatabase,
	updatePostStatus,
	deletePost,
	uploadBase64AndStore,
	compressBase64Image,
	uploadToSupabaseStorage
};

