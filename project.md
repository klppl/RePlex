# Wrapperr Project Technical Analysis

This document outlines the technical details of the Wrapperr project, specifically focusing on its integration with Tautulli for authentication, data retrieval, and data storage. This guide is intended to serve as a reference for building new projects based on these mechanisms.

## 1. Tautulli Connection & Authentication

The project uses Tautulli's API v2 for all interactions.

### Connection Logic
*   **Module**: `modules/tautulli.go`
*   **Function**: `TautulliTestConnection`
*   **Method**: HTTP `GET`
*   **Base URL Construction**:
    ```
    {protocol}://{ip}:{port}{root_path}/api/v2/
    ```
    *   `protocol`: `https` if SSL is enabled, otherwise `http`.
    *   `ip`: The Tautulli server IP address.
    *   `port`: The Tautulli server port.
    *   `root_path`: Optional web root if configured.

### Authentication
*   **Mechanism**: API Key authentication.
*   **Parameter**: `apikey` passed as a query string parameter.
*   **Validation**:
    *   The `cmd=status` command is used to verify the connection.
    *   A successful connection returns a JSON response with `response.result == "success"`.

**Example Request:**
```http
GET /api/v2/?apikey={API_KEY}&cmd=status HTTP/1.1
```

## 2. Data Retrieval

Wrapperr retrieves two main types of data: User information and Watch History.

### A. User Retrieval
*   **Function**: `TautulliGetUsers` (in `modules/tautulli.go`)
*   **Command**: `cmd=get_users`
*   **Purpose**: Fetches a list of users to map Plex users to Wrapperr statistics.
*   **Data Points Used**: `user_id`, `username`, `email`, `is_active`.

**Example Request:**
```http
GET /api/v2/?apikey={API_KEY}&cmd=get_users HTTP/1.1
```

### B. Watch History Retrieval (Statistics)
The core logic for fetching watch history is distributed between `modules/statistics.go` (`WrapperrDownloadDays`) and `modules/tautulli.go` (`TautulliDownloadStatistics`).

*   **Strategy**: Iterative Daily Fetching.
    *   The system iterates through each day within the configured "Wrapped" date range.
    *   It requests history specifically for that day (or starting from that day).

*   **Function**: `TautulliDownloadStatistics`
*   **Command**: `cmd=get_history`
*   **Key Parameters**:
    *   `apikey`: Auth key.
    *   `order_column`: `date` (Sort by date).
    *   `order_dir`: `desc` (Newest first).
    *   `include_activity`: `0` (Exclude currently active sessions).
    *   `length`: Configurable limit (e.g., 1000 items) to prevent timeouts/large payloads.
    *   `start_date`: The specific date being queried (format: `YYYY-MM-DD`).
    *   `grouping`: `1` or `0` (Groups similar items, e.g., episodes of a show).
    *   `section_id`: (Optional) Library ID to filter by specific libraries.

**Example Request:**
```http
GET /api/v2/?apikey={API_KEY}&cmd=get_history&order_column=date&order_dir=desc&include_activity=0&start_date=2023-01-01&length=1000&grouping=1 HTTP/1.1
```

*   **Processing**:
    *   The fetched data is filtered by `media_type` (movie, episode, track).
    *   It is then converted into `TautulliEntry` struct and appended to the daily record.

## 3. Data Storage

Data is stored locally in JSON files within the `config/` directory.

### A. User Storage
*   **File**: `config/users.json`
*   **Handler**: `files/users.go`
*   **Structure**: A JSON array of user objects.
*   **Fields**:
    *   `user_id`: Tautulli User ID.
    *   `user`: Plex Username.
    *   `friendly_name`: Display name.
    *   `email`: User email.
    *   `tautulli_servers`: List of servers the user belongs to.
    *   `active`: Boolean status.
    *   `ignore`: Boolean to exclude user from stats.

### B. Statistics Cache
*   **File**: `config/cache.json`
*   **Handler**: `files/cache.go`
*   **Purpose**: To avoid re-fetching data from Tautulli for days that have already been processed.
*   **Structure**: A JSON array of `WrapperrDay` objects.
*   **Schema**:
    ```json
    [
      {
        "date": "YYYY-MM-DD",
        "data_complete": true,
        "tautulli_servers": ["Server Name"],
        "data": [
          {
            "title": "Movie Title",
            "duration": 1200,
            "user_id": 12345,
            ...
          }
        ]
      }
    ]
    ```
*   **Logic**:
    *   Before fetching from API, `WrapperrDownloadDays` checks `cache.json`.
    *   If a date exists and `data_complete` is `true`, it skips the API call.
    *   If the date is the *current day*, `data_complete` is set to `false` so it updates on the next run.

## Summary of Technical Flow

1.  **Init**: Load configuration.
2.  **Auth Check**: `TautulliTestConnection` pings `cmd=status`.
3.  **User Sync**: `TautulliSyncUsersToWrapperr` fetches users (`cmd=get_users`) and updates `users.json`.
4.  **Stats Generation**:
    *   Load `cache.json`.
    *   Loop for each day in range:
        *   If cached: use cache.
        *   If not: call `TautulliDownloadStatistics` (`cmd=get_history`).
    *   Save updated data to `cache.json`.
    *   Process raw data into statistics (e.g., Top Movies, Total Duration).
