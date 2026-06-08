import { assertXApiConfigured, config } from "../config.js";
import type { StoredXTokens } from "./tokenStore.js";

const X_AUTHORIZE_URL = "https://twitter.com/i/oauth2/authorize";
const X_TOKEN_URL = "https://api.twitter.com/2/oauth2/token";
const X_USERS_ME_URL = "https://api.twitter.com/2/users/me?user.fields=username";
const X_TWEETS_URL = "https://api.twitter.com/2/tweets";
const X_MEDIA_UPLOAD_URL = "https://upload.twitter.com/1.1/media/upload.json";

const OAUTH_SCOPES = ["tweet.write", "users.read", "offline.access"];

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
};

type UsersMeResponse = {
  data?: {
    id: string;
    username: string;
  };
};

type TweetResponse = {
  data?: {
    id: string;
    text: string;
  };
};

type MediaUploadResponse = {
  media_id_string: string;
};

function basicAuthHeader(): string {
  assertXApiConfigured();
  const credentials = Buffer.from(
    `${config.xClientId}:${config.xClientSecret}`
  ).toString("base64");
  return `Basic ${credentials}`;
}

export function buildXAuthorizeUrl(params: {
  state: string;
  codeChallenge: string;
}): string {
  assertXApiConfigured();
  const search = new URLSearchParams({
    response_type: "code",
    client_id: config.xClientId,
    redirect_uri: config.callbackUrl,
    scope: OAUTH_SCOPES.join(" "),
    state: params.state,
    code_challenge: params.codeChallenge,
    code_challenge_method: "S256",
  });
  return `${X_AUTHORIZE_URL}?${search.toString()}`;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const body = await response.text();
  if (!response.ok) {
    throw new Error(
      `X API error (${response.status}): ${body || response.statusText}`
    );
  }
  return JSON.parse(body) as T;
}

export async function exchangeAuthorizationCode(params: {
  code: string;
  codeVerifier: string;
}): Promise<StoredXTokens> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: config.callbackUrl,
    code_verifier: params.codeVerifier,
    client_id: config.xClientId,
  });

  const response = await fetch(X_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuthHeader(),
    },
    body,
  });

  const token = await parseJsonResponse<TokenResponse>(response);
  if (!token.refresh_token) {
    throw new Error("X API did not return a refresh token");
  }

  const profile = await fetchAuthenticatedUser(token.access_token);

  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: Date.now() + token.expires_in * 1000 - 60_000,
    userId: profile?.id,
    username: profile?.username,
  };
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<StoredXTokens> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: config.xClientId,
  });

  const response = await fetch(X_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuthHeader(),
    },
    body,
  });

  const token = await parseJsonResponse<TokenResponse>(response);
  const profile = await fetchAuthenticatedUser(token.access_token);

  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? refreshToken,
    expiresAt: Date.now() + token.expires_in * 1000 - 60_000,
    userId: profile?.id,
    username: profile?.username,
  };
}

async function fetchAuthenticatedUser(
  accessToken: string
): Promise<UsersMeResponse["data"] | undefined> {
  const response = await fetch(X_USERS_ME_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    return undefined;
  }

  const json = (await response.json()) as UsersMeResponse;
  return json.data;
}

export async function ensureFreshAccessToken(
  tokens: StoredXTokens
): Promise<StoredXTokens> {
  if (tokens.expiresAt > Date.now()) {
    return tokens;
  }
  return refreshAccessToken(tokens.refreshToken);
}

export async function uploadTweetImage(
  accessToken: string,
  imageBuffer: Buffer
): Promise<string> {
  const form = new FormData();
  form.append(
    "media",
    new Blob([imageBuffer], { type: "image/png" }),
    "dorkfi-governance-vote.png"
  );

  const response = await fetch(X_MEDIA_UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: form,
  });

  const json = await parseJsonResponse<MediaUploadResponse>(response);
  return json.media_id_string;
}

export async function createTweetWithMedia(params: {
  accessToken: string;
  text: string;
  mediaId: string;
}): Promise<{ tweetId: string; tweetUrl: string }> {
  const response = await fetch(X_TWEETS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: params.text,
      media: {
        media_ids: [params.mediaId],
      },
    }),
  });

  const json = await parseJsonResponse<TweetResponse>(response);
  const tweetId = json.data?.id;
  if (!tweetId) {
    throw new Error("X API did not return a tweet id");
  }

  const username = await fetchAuthenticatedUser(params.accessToken);
  const handle = username?.username ?? "i";
  return {
    tweetId,
    tweetUrl: `https://x.com/${handle}/status/${tweetId}`,
  };
}
