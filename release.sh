#!/usr/bin/env bash

# Release Tag Manager with Smart Changelog Generation
# Creates and manages semantic versioning tags for releases
# Automatically generates intelligent changelog entries using Python script
# Automatically updates version numbers in package.json and README.md
# Works on Windows (Git Bash), Linux, and macOS

# Initialize variables
INCREMENT=""
NAME=""
SET_TAG=""
SHOW_CURRENT=false
FORCE=false
SKIP_CHANGELOG=false
DRY_RUN=false
PYTHON_SCRIPT="scripts/smart-changelog.py"
PACKAGE_VERSION_SCRIPT="scripts/update-package-version.mjs"
README_VERSION_SCRIPT="scripts/update-readme-version.mjs"

# Show help function
show_help() {
  echo "Usage: $0 [OPTIONS]"
  echo "Manage release tags with semantic versioning and intelligent changelog generation"
  echo ""
  echo "Options:"
  echo "  --major           Increment major version (vX.0.0)"
  echo "  --minor           Increment minor version (v0.X.0)"
  echo "  --patch           Increment patch version (v0.0.X) (default)"
  echo "  --name NAME       Append custom name to version (e.g., beta)"
  echo "  --set-tag TAG     Set specific tag (must be vX.Y.Z format)"
  echo "  --current         Show current release tag"
  echo "  --force           Force tag creation even if commit is tagged"
  echo "  --skip-changelog  Skip automatic changelog update"
  echo "  --dry-run         Preview release actions without making changes"
  echo "  --help            Show this help message"
  echo ""
  echo "Examples:"
  echo "  $0 --current"
  echo "  $0 --minor"
  echo "  $0 --major --name beta"
  echo "  $0 --set-tag v1.2.3"
  exit 0
}

# Function to check if Python script exists
check_python_script() {
  if [[ ! -f "$PYTHON_SCRIPT" ]]; then
    echo "⚠️  Warning: Python script not found at $PYTHON_SCRIPT"
    echo "   Smart changelog generation will be disabled"
    echo "   Using fallback template generation instead"
    return 1
  fi
  
  # Check if Python is available
  if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
    echo "⚠️  Warning: Python not found in PATH"
    echo "   Smart changelog generation will be disabled"
    echo "   Using fallback template generation instead"
    return 1
  fi
  
  return 0
}

# Function to get current date in YYYY-MM-DD format
get_current_date() {
  date +%Y-%m-%d
}

# Function to get previous tag for changelog generation
get_previous_tag() {
  local current_tag=$1
  
  if [[ -z "$current_tag" ]]; then
    echo "none"
    return
  fi
  
  # Get all tags sorted by version, including pre-releases
  local all_tags=$(git tag --sort=-version:refname | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+' | head -20)
  
  # Find the tag before the current one
  local found_current=false
  for tag in $all_tags; do
    if [[ "$found_current" == true ]]; then
      echo "$tag"
      return
    fi
    if [[ "$tag" == "$current_tag" ]]; then
      found_current=true
    fi
  done
  
  # If we didn't find the current tag in the list, it might be a new tag
  # In that case, get the most recent tag
  local latest_tag=$(echo "$all_tags" | head -1)
  if [[ -n "$latest_tag" && "$latest_tag" != "$current_tag" ]]; then
    echo "$latest_tag"
    return
  fi
  
  echo "none"
}

# Function to generate smart changelog using Python script
generate_smart_changelog() {
  local version=$1
  local release_name=$2
  local previous_tag=$3
  
  echo "🤖 Generating smart changelog using Python script..."
  
  # Determine Python command
  local python_cmd=""
  if command -v python3 &> /dev/null; then
    python_cmd="python3"
  elif command -v python &> /dev/null; then
    python_cmd="python"
  else
    echo "❌ Error: Python not found"
    return 1
  fi
  
  # Run the Python script
  if [[ -n "$release_name" ]]; then
    $python_cmd "$PYTHON_SCRIPT" "$version" "$release_name" "$previous_tag"
  else
    $python_cmd "$PYTHON_SCRIPT" "$version" "" "$previous_tag"
  fi
  
  if [[ $? -eq 0 ]]; then
    echo "✅ Smart changelog generated successfully"
    echo "✅ Release links updated automatically"
    return 0
  else
    echo "❌ Error: Failed to generate smart changelog"
    return 1
  fi
}

# Function to update release links in changelog
update_release_links_fallback() {
  local version=$1
  local changelog_file="CHANGELOG.md"
  
  if [[ ! -f "$changelog_file" ]]; then
    echo "Warning: CHANGELOG.md not found"
    return 1
  fi
  
  # Get repository info from git remote
  local remote_url=$(git remote get-url origin 2>/dev/null || echo "")
  local owner="Hum2a"
  local repo="Bgr8"
  
  if [[ -n "$remote_url" && "$remote_url" == *"github.com"* ]]; then
    # Extract owner and repo from URL
    if [[ "$remote_url" =~ github\.com[:/]([^/]+)/([^/]+?)(?:\.git)?$ ]]; then
      owner="${BASH_REMATCH[1]}"
      repo="${BASH_REMATCH[2]}"
    fi
  fi
  
  # Create the new release link
  local new_link="[$version]: https://github.com/$owner/$repo/releases/tag/$version"
  
  # Check if the release links section exists and if this version already exists
  if grep -q "## 📋 Release Links" "$changelog_file" && ! grep -q "\[$version\]:" "$changelog_file"; then
    # Find the line number after "## 📋 Release Links"
    local insert_line=$(grep -n "## 📋 Release Links" "$changelog_file" | cut -d: -f1)
    insert_line=$((insert_line + 2))  # After header and empty line
    
    # Insert the new link
    sed -i "${insert_line}i\\$new_link" "$changelog_file"
    echo "✅ Added release link: $new_link"
    return 0
  elif grep -q "\[$version\]:" "$changelog_file"; then
    echo "ℹ️  Release link for $version already exists"
    return 0
  else
    echo "Warning: Could not find release links section or update failed"
    return 1
  fi
}

# Append git commit bullets for this release (no Python); used by fallback entry
append_fallback_git_commits() {
  local previous_tag=$1

  echo "### Changes"
  if [[ -n "$previous_tag" && "$previous_tag" != "none" ]] && git rev-parse "$previous_tag" >/dev/null 2>&1; then
    local count
    count=$(git rev-list --count "${previous_tag}..HEAD" 2>/dev/null || echo 0)
    if [[ "${count:-0}" -gt 0 ]]; then
      git log "${previous_tag}..HEAD" --pretty=format:"- %s" --no-merges
    else
      echo "- _No commits since ${previous_tag}._"
    fi
  else
    local count
    count=$(git rev-list --count HEAD 2>/dev/null || echo 0)
    if [[ "${count:-0}" -gt 0 ]]; then
      git log --pretty=format:"- %s" --no-merges -n 100
    else
      echo "- _No commits found to list._"
    fi
  fi
  echo ""
  echo "---"
}

# Function to generate fallback changelog entry (git-backed bullets; no checklist placeholders)
generate_fallback_changelog_entry() {
  local version=$1
  local date=$2
  local name=$3
  local previous_tag=$4

  # Determine release type and emoji
  local release_type=""
  local emoji=""

  if [[ "$version" =~ ^v[0-9]+\.[0-9]+\.[0-9]+ ]]; then
    # Regular version (suffix like -beta allowed for pre-release block below — keep simple)
    if [[ "$version" =~ ^v[0-9]+\.0\.0([^0-9].*)?$ ]]; then
      release_type="Major Release"
      emoji="🚀"
    elif [[ "$version" =~ ^v[0-9]+\.[0-9]+\.0([^0-9].*)?$ ]]; then
      release_type="Minor Release"
      emoji="✨"
    elif [[ "$version" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
      release_type="Patch Release"
      emoji="🐛"
    else
      release_type="Pre-release"
      emoji="🔧"
    fi
  else
    release_type="Pre-release"
    emoji="🔧"
  fi

  echo ""
  echo "## [$version] - $date"
  echo ""
  echo "### $emoji $release_type"

  if [[ -n "$name" ]]; then
    echo ""
    echo "**Codename:** $name"
  fi
  echo ""
  append_fallback_git_commits "$previous_tag"
}

# Function to update changelog
update_changelog() {
  local version=$1
  local date=$2
  local name=$3
  local previous_tag=$4
  
  local changelog_file="CHANGELOG.md"
  
  if [[ ! -f "$changelog_file" ]]; then
    echo "Warning: CHANGELOG.md not found. Creating new changelog file."
    cat > "$changelog_file" << EOF
# 📝 Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

EOF
  fi
  
  # Try to generate smart changelog first
  if check_python_script; then
    if generate_smart_changelog "$version" "$name" "$previous_tag"; then
      # The Python script generates its own file, so we need to integrate it
      local smart_changelog_file="smart-changelog-${version}.md"
      if [[ -f "$smart_changelog_file" ]]; then
        # Read the smart changelog content
        local smart_content=$(cat "$smart_changelog_file")
        
        # Insert the smart changelog entry at the top (after the header)
        # Find the line after the header section (after the last line that starts with # or >)
        local header_end=0
        local line_num=0
        
        while IFS= read -r line; do
          line_num=$((line_num + 1))
          # Check if this line starts a new section (## [version] or ## [0.x.x])
          if [[ "$line" =~ ^##\ \[ ]]; then
            header_end=$((line_num - 1))
            break
          fi
        done < "$changelog_file"
        
        # If no existing entries found, insert after the header description
        if [[ $header_end -eq 0 ]]; then
          # Find the last line of the header (after the description line)
          header_end=$(grep -n "^>" "$changelog_file" | tail -1 | cut -d: -f1)
          if [[ -n "$header_end" ]]; then
            header_end=$((header_end + 1))
          else
            # If no description line, insert after the last header line
            header_end=$(grep -n "^#" "$changelog_file" | tail -1 | cut -d: -f1)
            if [[ -n "$header_end" ]]; then
              header_end=$((header_end + 1))
            else
              header_end=1
            fi
          fi
        fi
        
        # Create temporary file
        local temp_file=$(mktemp)
        
        # Insert at the top (after header)
        head -n "$header_end" "$changelog_file" > "$temp_file"
        echo "$smart_content" >> "$temp_file"
        tail -n +$((header_end + 1)) "$changelog_file" >> "$temp_file"
        
        # Replace original file
        mv "$temp_file" "$changelog_file"
        
        # Clean up the temporary smart changelog file
        rm -f "$smart_changelog_file"
        
        echo "✅ Updated CHANGELOG.md with smart changelog entry at the top"
        echo "🔗 Updating release links for $version..."
        if update_release_links_fallback "$version"; then
          echo "✅ Release links updated successfully"
        else
          echo "⚠️  Warning: Could not update release links"
        fi
        return 0
      fi
    fi
  fi
  
  # Fallback when smart script fails or did not produce a file
  echo "📝 Using fallback changelog generation (git log)…"
  local new_entry
  new_entry=$(generate_fallback_changelog_entry "$version" "$date" "$name" "$previous_tag")
  
  # Insert the new entry at the top (after the header)
  if [[ -f "$changelog_file" ]]; then
    # Create temporary file
    local temp_file=$(mktemp)
    
    # Find the line after the header section (after the last line that starts with # or >)
    local header_end=0
    local line_num=0
    
    while IFS= read -r line; do
      line_num=$((line_num + 1))
      # Check if this line starts a new section (## [version] or ## [0.x.x])
      if [[ "$line" =~ ^##\ \[ ]]; then
        header_end=$((line_num - 1))
        break
      fi
    done < "$changelog_file"
    
    # If no existing entries found, insert after the header description
    if [[ $header_end -eq 0 ]]; then
      # Find the last line of the header (after the description line)
      header_end=$(grep -n "^>" "$changelog_file" | tail -1 | cut -d: -f1)
      if [[ -n "$header_end" ]]; then
        header_end=$((header_end + 1))
      else
        # If no description line, insert after the last header line
        header_end=$(grep -n "^#" "$changelog_file" | tail -1 | cut -d: -f1)
        if [[ -n "$header_end" ]]; then
          header_end=$((header_end + 1))
        else
          header_end=1
        fi
      fi
    fi
    
    # Insert at the top (after header)
    head -n "$header_end" "$changelog_file" > "$temp_file"
    echo "$new_entry" >> "$temp_file"
    tail -n +$((header_end + 1)) "$changelog_file" >> "$temp_file"
    
    # Replace original file
    mv "$temp_file" "$changelog_file"
    
    echo "✅ Updated CHANGELOG.md with fallback changelog entry at the top"
    
    # Update release links in fallback mode
    echo "🔗 Updating release links for $version..."
    if update_release_links_fallback "$version"; then
      echo "✅ Release links updated successfully"
    else
      echo "⚠️  Warning: Could not update release links"
    fi
  fi
}

# Function to update version in package.json
update_package_json() {
  local version=$1
  
  if [[ ! -f "$PACKAGE_VERSION_SCRIPT" ]]; then
    echo "⚠️  Warning: $PACKAGE_VERSION_SCRIPT not found"
    return 1
  fi

  if ! command -v node &> /dev/null; then
    echo "⚠️  Warning: node command not found, cannot update package versions"
    return 1
  fi

  if node "$PACKAGE_VERSION_SCRIPT" "$version"; then
    echo "✅ Updated package.json versions to ${version#v}"
    return 0
  else
    echo "⚠️  Warning: Failed to update package.json versions"
    return 1
  fi
}

# Function to update version in README.md
update_readme() {
  local version=$1
  local repo_slug=$2

  if [[ ! -f "$README_VERSION_SCRIPT" ]]; then
    echo "⚠️  Warning: $README_VERSION_SCRIPT not found"
    return 1
  fi

  if ! command -v node &> /dev/null; then
    echo "⚠️  Warning: node command not found, cannot update README.md"
    return 1
  fi

  if node "$README_VERSION_SCRIPT" "$version" "$repo_slug"; then
    echo "✅ Updated README.md release badge to ${version#v}"
    return 0
  else
    echo "⚠️  Warning: Failed to update README.md version badge"
    return 1
  fi
}

# Function to commit changelog changes
commit_changelog() {
  local version=$1
  
  if [[ -n "$(git status --porcelain CHANGELOG.md)" ]]; then
    echo "Committing changelog changes..."
    git add CHANGELOG.md
    git commit -m "📝 Update changelog for $version" --no-verify
    
    if [[ $? -eq 0 ]]; then
      echo "✅ Committed changelog changes"
      return 0
    else
      echo "⚠️  Warning: Failed to commit changelog changes"
      return 1
    fi
  else
    echo "ℹ️  No changelog changes to commit"
    return 0
  fi
}

# Function to commit version updates
commit_version_updates() {
  local version=$1
  local files_to_commit=()
  
  # Check which files have changes
  while IFS= read -r changed_file; do
    [[ -n "$changed_file" ]] && files_to_commit+=("$changed_file")
  done < <(git status --porcelain | awk '{print $2}' | grep -E '(^README\.md$|^package\.json$|^packages/.*/package\.json$)' || true)
  
  if [[ ${#files_to_commit[@]} -gt 0 ]]; then
    echo "Committing version updates..."
    git add "${files_to_commit[@]}"
    git commit -m "🔢 Update version to $version in package.json and README.md" --no-verify
    
    if [[ $? -eq 0 ]]; then
      echo "✅ Committed version updates for $version"
      return 0
    else
      echo "⚠️  Warning: Failed to commit version updates"
      return 1
    fi
  else
    echo "ℹ️  No version updates to commit"
    return 0
  fi
}

# Function to extract owner/repo from origin remote
get_repo_slug() {
  local remote_url=$(git remote get-url origin 2>/dev/null || echo "")
  if [[ "$remote_url" =~ github\.com[:/]([^/]+/[^/.]+)(\.git)?$ ]]; then
    echo "${BASH_REMATCH[1]}"
  else
    echo "unknown/unknown"
  fi
}

show_dry_run_plan() {
  local new_tag=$1
  local latest_tag=$2
  local previous_tag=$3
  local repo_slug=$4

  echo ""
  echo "🧪 Dry run mode enabled (no files, commits, tags, or pushes will be changed)"
  echo "------------------------------------------------------------"
  echo "Latest remote tag: ${latest_tag:-none}"
  echo "Next tag:          $new_tag"
  echo "Repo slug:         $repo_slug"
  echo "Changelog from:    ${previous_tag:-none}"
  echo ""
  echo "Would run:"
  echo "  1) Update package versions via $PACKAGE_VERSION_SCRIPT"
  echo "  2) Update README badge via $README_VERSION_SCRIPT"
  if [[ "$SKIP_CHANGELOG" == false ]]; then
    echo "  3) Update CHANGELOG.md (smart/fallback)"
  else
    echo "  3) Skip changelog update (--skip-changelog)"
  fi
  echo "  4) Commit changed version/changelog files"
  echo "  5) Create tag $new_tag"
  echo "  6) Push release commit(s) to main/master and push tag"
  echo "------------------------------------------------------------"
}

# Parse long arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --major)
      if [[ -n "$INCREMENT" ]]; then
        echo "Error: Cannot use multiple version flags together (--major, --minor, --patch, --set-tag)"
        exit 1
      fi
      INCREMENT="major"
      shift
      ;;
    --minor)
      if [[ -n "$INCREMENT" ]]; then
        echo "Error: Cannot use multiple version flags together (--major, --minor, --patch, --set-tag)"
        exit 1
      fi
      INCREMENT="minor"
      shift
      ;;
    --patch)
      if [[ -n "$INCREMENT" ]]; then
        echo "Error: Cannot use multiple version flags together (--major, --minor, --patch, --set-tag)"
        exit 1
      fi
      INCREMENT="patch"
      shift
      ;;
    --name)
      if [[ "$SHOW_CURRENT" == true ]]; then
        echo "Error: Cannot use --name with --current"
        exit 1
      fi
      NAME="$2"
      shift 2
      ;;
    --set-tag)
      if [[ -n "$INCREMENT" ]]; then
        echo "Error: Cannot use multiple version flags together (--major, --minor, --patch, --set-tag)"
        exit 1
      fi
      SET_TAG="$2"
      # Validate tag format
      if [[ ! "$SET_TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9-]+)?$ ]]; then
        echo "Error: Tag must be in format vX.Y.Z or vX.Y.Z-NAME (e.g., v1.2.3 or v1.2.3-beta)"
        exit 1
      fi
      INCREMENT="set"
      shift 2
      ;;
    --current)
      if [[ -n "$INCREMENT" || -n "$NAME" || "$FORCE" == true ]]; then
        echo "Error: Cannot combine --current with other options"
        exit 1
      fi
      SHOW_CURRENT=true
      shift
      ;;
    --force)
      if [[ "$SHOW_CURRENT" == true ]]; then
        echo "Error: Cannot use --force with --current"
        exit 1
      fi
      FORCE=true
      shift
      ;;
    --skip-changelog)
      SKIP_CHANGELOG=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --help)
      show_help
      ;;
    *)
      echo "Error: Unknown option $1"
      show_help
      exit 1
      ;;
  esac
done

# Default to patch if no version option specified
if [[ -z "$INCREMENT" && "$SHOW_CURRENT" == false ]]; then
  INCREMENT="patch"
fi

# Always sync with remote tags first
echo "Syncing with remote tags..."
git fetch --tags --force >/dev/null 2>&1

# Get current commit hash
CURRENT_COMMIT=$(git rev-parse HEAD)

# Get latest tag from remote
LATEST_TAG=$(git ls-remote --tags --refs --sort=-v:refname origin | head -n 1 | sed 's/.*\///')

# Show current tag if requested
if [[ "$SHOW_CURRENT" == true ]]; then
  if [[ -z "$LATEST_TAG" ]]; then
    echo "No releases found"
    exit 0
  fi
  
  TAG_COMMIT=$(git ls-remote origin refs/tags/"$LATEST_TAG" | cut -f 1)
  echo "Latest release tag: $LATEST_TAG"
  echo "Tag points to commit: $TAG_COMMIT"
  echo "Current commit: $CURRENT_COMMIT"
  
  if [[ "$TAG_COMMIT" == "$CURRENT_COMMIT" ]]; then
    echo "Status: Current commit is tagged"
  else
    echo "Status: Current commit is not tagged"
  fi
  exit 0
fi

# Handle set-tag mode
if [[ "$INCREMENT" == "set" ]]; then
  NEW_TAG="$SET_TAG"
  echo "Setting tag directly to: $NEW_TAG"
else
  # Set default version if no tags exist
  if [[ -z "$LATEST_TAG" ]]; then
    LATEST_TAG="v0.0.0"
    echo "No existing tags found. Starting from v0.0.0"
  else
    echo "Current release tag: $LATEST_TAG"
  fi

  # Extract version numbers
  CLEAN_TAG=${LATEST_TAG#v}
  MAJOR=$(echo "$CLEAN_TAG" | cut -d. -f1)
  MINOR=$(echo "$CLEAN_TAG" | cut -d. -f2)
  PATCH=$(echo "$CLEAN_TAG" | cut -d. -f3 | sed 's/-.*//') # Remove any suffixes

  # Increment version based on selection
  case $INCREMENT in
    major)
      MAJOR=$((MAJOR + 1))
      MINOR=0
      PATCH=0
      ;;
    minor)
      MINOR=$((MINOR + 1))
      PATCH=0
      ;;
    patch)
      PATCH=$((PATCH + 1))
      ;;
  esac

  # Construct new tag
  NEW_TAG="v${MAJOR}.${MINOR}.${PATCH}"

  # Append custom name if provided
  if [[ -n "$NAME" ]]; then
    SANITIZED_NAME=$(echo "$NAME" | tr -cd '[:alnum:]-' | tr ' ' '-')
    NEW_TAG="${NEW_TAG}-${SANITIZED_NAME}"
  fi
fi

# Check if tag already exists locally or remotely
echo "Checking for existing tags..."
EXISTING_REMOTE=$(git ls-remote origin "refs/tags/${NEW_TAG}")
EXISTING_LOCAL=$(git tag -l "$NEW_TAG")

# Delete existing tags if found
if [[ -n "$EXISTING_REMOTE" || -n "$EXISTING_LOCAL" ]]; then
  echo "Tag $NEW_TAG already exists - deleting old version"
  
  # Delete remote tag
  if [[ -n "$EXISTING_REMOTE" ]]; then
    echo "Deleting remote tag: $NEW_TAG"
    git push --delete origin "$NEW_TAG" >/dev/null 2>&1 || true
  fi
  
  # Delete local tag
  if [[ -n "$EXISTING_LOCAL" ]]; then
    echo "Deleting local tag: $NEW_TAG"
    git tag -d "$NEW_TAG" >/dev/null 2>&1 || true
  fi
fi

# Check if current commit is already tagged
if [[ -n "$LATEST_TAG" ]]; then
  TAG_COMMIT=$(git ls-remote origin refs/tags/"$LATEST_TAG" | cut -f 1)
  if [[ "$TAG_COMMIT" == "$CURRENT_COMMIT" && "$FORCE" == false ]]; then
    echo "Error: Current commit is already tagged as $LATEST_TAG"
    echo "Use --force to create a new tag on this commit"
    exit 1
  fi
fi

REPO_SLUG=$(get_repo_slug)
PREVIOUS_TAG=$(get_previous_tag "$LATEST_TAG")

if [[ "$DRY_RUN" == true ]]; then
  show_dry_run_plan "$NEW_TAG" "$LATEST_TAG" "$PREVIOUS_TAG" "$REPO_SLUG"
  exit 0
fi

# Update version numbers in package.json and README.md
echo "🔢 Updating version numbers..."
update_package_json "$NEW_TAG"
update_readme "$NEW_TAG" "$REPO_SLUG"

# Update changelog if not skipped
if [[ "$SKIP_CHANGELOG" == false ]]; then
  echo "Updating changelog..."
  CURRENT_DATE=$(get_current_date)
  echo "📝 Analyzing commits since: $PREVIOUS_TAG"
  update_changelog "$NEW_TAG" "$CURRENT_DATE" "$NAME" "$PREVIOUS_TAG"
else
  echo "Skipping changelog update (--skip-changelog flag used)"
fi

# Commit version updates before tagging so the tag points to release artifacts
commit_version_updates "$NEW_TAG"

# Commit changelog changes if any
if [[ "$SKIP_CHANGELOG" == false ]]; then
  commit_changelog "$NEW_TAG"
fi

# Create and push new tag after commits
echo "Creating new tag: $NEW_TAG"
git tag "$NEW_TAG"

if [[ $? -eq 0 ]]; then
  echo "✅ Successfully created release tag: $NEW_TAG"

  # Push commits first, then tag
  echo "Pushing release commit(s) and tag to remote..."
  git push origin HEAD:main 2>/dev/null || git push origin HEAD:master 2>/dev/null || echo "Note: Could not push to main/master branch"
  git push origin "$NEW_TAG"

  echo "🎉 Release $NEW_TAG successfully created and pushed!"
  echo "Tag URL: https://github.com/$REPO_SLUG/releases/tag/$NEW_TAG"
  echo ""
  echo "✅ Version updates completed:"
  echo "   - package.json version updated to ${NEW_TAG#v}"
  echo "   - README.md version badge updated to ${NEW_TAG#v}"
  
  if [[ "$SKIP_CHANGELOG" == false ]]; then
    echo ""
    echo "📝 Next steps:"
    echo "1. Review the generated changelog entry in CHANGELOG.md"
    echo "2. Update the changelog with any additional details if needed"
    echo "3. Commit and push the final changelog if you made changes"
    echo "4. Create a GitHub release with the changelog content"
    echo ""
    echo "💡 Tip: The changelog was generated using git commit analysis for accuracy!"
  fi
else
  echo "Error: Failed to create tag"
  exit 1
fi