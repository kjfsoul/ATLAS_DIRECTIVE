# Multi-Chunk Narrative Validation System

## Overview

The ATLAS Directive supports both single-file and multi-chunk narrative architectures. The enhanced validation system automatically detects and validates narrative content regardless of the storage format.

## Architecture Modes

### Single File Mode (Legacy)
- **File Pattern**: `narrative_tree_complete_*.json`
- **Location**: Project root
- **Use Case**: Complete narrative in one file

### Multi-Chunk Mode (Scalable)
- **File Pattern**: `narrative_tree_chunk*.json`
- **Location**: `data/` directory
- **Use Case**: Large narratives split across multiple files

## Validation System

### Automatic Detection
The validator automatically detects which mode to use:
```bash
# Single file mode (default)
npm run narrative:validate

# Multi-chunk mode (explicit)
npm run narrative:validate:multi
```

### Validation Phases

#### Phase 1: Individual Chunk Validation
Each chunk is validated independently for:
- ✅ JSON schema compliance
- ✅ Node ID uniqueness (within chunk)
- ✅ Reference integrity (next_id, grants, requires)
- ✅ Token economy balance
- ✅ Achievement flag availability
- ✅ Scientific accuracy
- ✅ Reachability from chunk root

#### Phase 2: Cross-Chunk Constraint Validation
Global constraints across all chunks:
- ✅ **Unique Node IDs**: No duplicate IDs across all chunks
- ✅ **Flag Consistency**: Achievement flags properly distributed
- ✅ **Inter-chunk References**: Cross-chunk links (if implemented)
- ✅ **Token Economy**: Global token balance across chunks

#### Phase 3: Comprehensive Reporting
- 📊 Per-chunk statistics
- 🌍 Global metrics
- 🚨 Consolidated error/warning reporting
- ✅ Success/failure determination

## CI/CD Integration

### GitHub Actions Workflow
The validation runs automatically on:
- ✅ **Pull Requests**: All PRs to main branch
- ✅ **Pushes**: All commits to main branch
- ✅ **Releases**: All version tags

### Failure Conditions
Build fails if:
- ❌ Single file validation errors
- ❌ Multi-chunk validation errors
- ❌ Schema violations
- ❌ Dangling references
- ❌ Token economy imbalances

### Quality Gates
- ✅ **Zero Error Tolerance**: No errors allowed in production
- ✅ **Warning Monitoring**: Warnings logged but don't fail builds
- ✅ **Meta Parity**: Node counts must match metadata

## Narrative Edit Lock Protocol

### Lock Mechanism
- 🔒 **File-based Locks**: `narrative_edit.lock` files prevent concurrent edits (located at repo root)
- 🔒 **Agent Coordination**: Kilo/Roo coordination via lock files and the C123 manager scripts
- 🔒 **Atomic Operations**: All changes committed together

### Lock Protocol Rules
1. **Check Lock Status**: Before editing, run the lock checker: `npm run lock:check` or `node ./scripts/checkNarrativeEditLock.js`
2. **Acquire Lock**: Create lock file with timestamp and agent ID: `npm run lock:acquire -- --agent Kilo`
3. **Perform Edits**: Make all changes atomically
4. **Release Lock**: Remove lock file after successful commit: `npm run lock:release -- --agent Kilo`
5. **Conflict Resolution**: Manual intervention for complex conflicts

### Lock File Format
```json
{
  "agent": "Kilo",
  "timestamp": "2025-10-11T03:58:19.780Z",
  "operation": "Golden Path fixes",
  "files": ["narrative_tree_complete_120_nodes.json"]
}
```

## Development Workflow

### For Single File Narratives
```bash
# 1. Validate current state
npm run narrative:validate

# 2. Make edits (creates lock)
# 3. Commit changes
# 4. CI/CD validates automatically
```

### For Multi-Chunk Narratives
```bash
# 1. Validate all chunks
npm run narrative:validate:multi

# 2. Edit individual chunks (with locking)
# 3. Commit all changes together
# 4. CI/CD validates cross-chunk integrity
```

## Error Handling

### Common Issues

#### Meta Parity Errors
```
❌ META PARITY FAILURE: meta.total_nodes (45) !== nodes.length (40)
```
**Solution**: Update `meta.total_nodes` to match actual node count

#### Dangling References
```
❌ Invalid next_id "nonexistent_node"
```
**Solution**: Ensure all `next_id` values point to existing nodes

#### Duplicate Node IDs
```
❌ Duplicate node ID: mission_briefing
```
**Solution**: Ensure unique IDs across all chunks

#### Token Economy Issues
```
❌ Token economy imbalance: costs exceed earning potential
```
**Solution**: Adjust token costs or earning rules

### Debugging Tips

1. **Run Single Chunk**: Test individual chunks before multi-chunk validation
2. **Check Lock Files**: Ensure no stale locks blocking validation
3. **Review Logs**: Check detailed validation output for specific issues
4. **Manual Testing**: Run validator locally before pushing

## Best Practices

### Chunk Organization
- 📁 **Logical Splitting**: Split by narrative arcs or chapters
- 🔗 **Minimize Cross-References**: Keep chunks self-contained when possible
- 📊 **Balanced Sizes**: Aim for similar node counts per chunk

### Validation Optimization
- 🚀 **Incremental Validation**: Validate chunks as they're edited
- 📋 **Pre-commit Hooks**: Run validation before commits
- 🔍 **Regular Audits**: Periodic full validation reviews

### Team Coordination
- 👥 **Clear Ownership**: Assign chunks to specific team members
- 🔒 **Lock Communication**: Use lock files for coordination
- 📞 **Conflict Resolution**: Established process for edit conflicts

## Future Enhancements

### Planned Features
- 🔗 **Inter-chunk Linking**: Support for cross-chunk node references
- 📊 **Performance Metrics**: Validation performance tracking
- 🤖 **Auto-fix Suggestions**: Automated error correction proposals
- 🌐 **Distributed Validation**: Multi-machine validation for large projects

### Extension Points
- 🎯 **Custom Validators**: Plugin architecture for domain-specific validation
- 📈 **Metrics Collection**: Detailed validation metrics and trends
- 🔄 **Incremental Updates**: Smart validation for incremental changes

---

*This documentation is automatically validated as part of the multi-chunk validation system.*

### C123 Manager
A small CLI/manager is provided under `./scripts/c123-manager.js` to orchestrate lock checks, acquire/release, merges and reports.
Basic usage:
- `node ./scripts/c123-manager.js status`
- `node ./scripts/c123-manager.js acquire --agent Kilo`
- `node ./scripts/c123-manager.js release --agent Kilo`
- `node ./scripts/c123-manager.js merge`

The manager coordinates narrative edits and performs a trivial merge/validation step before producing the combined narrative file.
