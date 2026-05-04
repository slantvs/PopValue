import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type {
  CollectionEntry,
  Condition,
  FunkoItem,
  IdentificationCandidate,
  ManualSearchFields,
  PublicProfile,
  ProfileUser,
  RetailOffer,
  ScanResult,
  ValuationResult
} from './types';
import { authService } from './services/authService';
import { cloudCollectionService } from './services/cloudCollectionService';
import {
  collectionItemKey,
  collectionService,
  findMatchingCollectionEntry,
  parseCollectionExport
} from './services/collectionService';
import { ebayService } from './services/ebayService';
import { identifyService } from './services/identifyService';
import { enrichItemImageFromListings } from './services/itemImageService';
import { buildProvisionalFunkoItem } from './services/provisionalItemService';
import { retailService } from './services/retailService';
import { scanService } from './services/scanService';
import type { CameraScannerControls } from './services/scanService';
import { valuationService } from './services/valuationService';

const emptyManual: ManualSearchFields = {
  name: '',
  franchise: '',
  series: '',
  boxNumber: '',
  variant: ''
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

const fallbackImageUrl = 'https://placehold.co/600x800/111827/f8fafc?text=PopValue';
const profileAvatarMaxBytes = 5 * 1024 * 1024;
const conditionLabels: Record<Condition, string> = {
  mint: 'Mint',
  good: 'Good',
  damaged: 'Damaged',
  'out of box': 'Out of box'
};

type CollectionSort = 'saved-desc' | 'saved-asc' | 'value-desc' | 'value-asc' | 'name-asc' | 'franchise-asc';
type CollectionViewMode = 'cards' | 'compact';

const sortLabels: Record<CollectionSort, string> = {
  'saved-desc': 'Newest saved',
  'saved-asc': 'Oldest saved',
  'value-desc': 'Highest value',
  'value-asc': 'Lowest value',
  'name-asc': 'Name A-Z',
  'franchise-asc': 'Franchise A-Z'
};

const getPublicProfileHandleFromLocation = () => {
  const queryHandle = new URLSearchParams(window.location.search).get('profile');
  if (queryHandle) return queryHandle;

  const [section, handle] = window.location.pathname.split('/').filter(Boolean);
  return ['u', 'profile'].includes(section ?? '') ? handle : null;
};

const publicProfilePath = (handle: string) => `/u/${handle}`;

const fallbackImage = (event: { currentTarget: HTMLImageElement }) => {
  if (event.currentTarget.src !== fallbackImageUrl) event.currentTarget.src = fallbackImageUrl;
};

function App() {
  const [manual, setManual] = useState<ManualSearchFields>(emptyManual);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [candidates, setCandidates] = useState<IdentificationCandidate[]>([]);
  const [selectedItem, setSelectedItem] = useState<FunkoItem | null>(null);
  const [valuation, setValuation] = useState<ValuationResult | null>(null);
  const [retailOffers, setRetailOffers] = useState<RetailOffer[]>([]);
  const [collection, setCollection] = useState<CollectionEntry[]>(() => collectionService.list());
  const [profileUser, setProfileUser] = useState<ProfileUser | null>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authError, setAuthError] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [authLoading, setAuthLoading] = useState('');
  const [localCollectionCount, setLocalCollectionCount] = useState(() => collectionService.list().length);
  const [profileDetails, setProfileDetails] = useState<PublicProfile | null>(null);
  const [profileHandle, setProfileHandle] = useState('');
  const [profileDisplayName, setProfileDisplayName] = useState('');
  const [profileAvatarUrl, setProfileAvatarUrl] = useState('');
  const [profileAvatarFile, setProfileAvatarFile] = useState<File | null>(null);
  const [profileAvatarPreview, setProfileAvatarPreview] = useState('');
  const [profileBio, setProfileBio] = useState('');
  const [profilePublic, setProfilePublic] = useState(true);
  const [profileLookup, setProfileLookup] = useState('');
  const [publicProfile, setPublicProfile] = useState<PublicProfile | null>(null);
  const [publicCollection, setPublicCollection] = useState<CollectionEntry[]>([]);
  const [publicLookupError, setPublicLookupError] = useState('');
  const [publicLookupLoading, setPublicLookupLoading] = useState('');
  const [notes, setNotes] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [condition, setCondition] = useState<Condition>('mint');
  const [isCollectionOpen, setCollectionOpen] = useState(false);
  const [marketMessages, setMarketMessages] = useState<string[]>([]);
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');
  const imagePreviewRef = useRef<string | undefined>(undefined);
  const profileAvatarPreviewRef = useRef<string | undefined>(undefined);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraControlsRef = useRef<CameraScannerControls | null>(null);
  const [cameraActive, setCameraActive] = useState(false);

  const totalCollectionValue = useMemo(() => collectionService.totalEstimatedValue(collection), [collection]);
  const publicCollectionValue = useMemo(
    () => collectionService.totalEstimatedValue(publicCollection),
    [publicCollection]
  );
  const profileShareUrl = profileDetails?.username
    ? `${window.location.origin}${publicProfilePath(profileDetails.username)}`
    : '';
  const duplicateEntry = useMemo(
    () => (selectedItem ? findMatchingCollectionEntry(collection, selectedItem) : undefined),
    [collection, selectedItem]
  );

  useEffect(() => {
    return () => {
      cameraControlsRef.current?.stop();
      if (imagePreviewRef.current) URL.revokeObjectURL(imagePreviewRef.current);
      if (profileAvatarPreviewRef.current) URL.revokeObjectURL(profileAvatarPreviewRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isCollectionOpen) return undefined;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setCollectionOpen(false);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCollectionOpen]);

  useEffect(() => {
    if (!authService.configured) return undefined;

    void authService.currentUser().then(setProfileUser);
    return authService.onAuthChange(setProfileUser);
  }, []);

  useEffect(() => {
    let active = true;

    if (!profileUser) {
      setCollection(collectionService.list());
      setProfileDetails(null);
      setProfileHandle('');
      setProfileDisplayName('');
      setProfileAvatarUrl('');
      clearProfileAvatarPreview();
      setProfileBio('');
      setProfilePublic(true);
      setLocalCollectionCount(collectionService.list().length);
      return () => {
        active = false;
      };
    }

    setAuthLoading('Loading profile collection...');
    Promise.allSettled([cloudCollectionService.list(profileUser.id), cloudCollectionService.getProfile(profileUser.id)])
      .then(([entriesResult, profileResult]) => {
        if (!active) return;

        const entries = entriesResult.status === 'fulfilled' ? entriesResult.value : [];
        const profile = profileResult.status === 'fulfilled' ? profileResult.value : null;

        setCollection(entries);
        setProfileDetails(profile);
        setProfileHandle(profile?.username ?? '');
        setProfileDisplayName(profile?.displayName ?? '');
        setProfileAvatarUrl(profile?.avatarUrl ?? '');
        clearProfileAvatarPreview();
        setProfileBio(profile?.bio ?? '');
        setProfilePublic(profile?.collectionPublic ?? true);
        setLocalCollectionCount(collectionService.list().length);
        if (profileResult.status === 'rejected') {
          setAuthError('Run the latest Supabase schema to enable public profile handles.');
        }
        setAuthMessage(entries.length ? 'Profile collection loaded.' : 'Profile ready. Saved Pops will sync here.');
      })
      .catch(() => {
        if (active) setAuthError('Could not load your profile collection. Local collection is still available if you sign out.');
      })
      .finally(() => {
        if (active) setAuthLoading('');
      });

    return () => {
      active = false;
    };
  }, [profileUser]);

  useEffect(() => {
    if (!authService.configured) return;

    const handle = getPublicProfileHandleFromLocation();
    if (!handle) return;

    setProfileLookup(handle);
    void lookupPublicCollection(handle);
  }, []);

  function applyScanResult(scan: ScanResult) {
    if (imagePreviewRef.current && imagePreviewRef.current !== scan.imagePreview) {
      URL.revokeObjectURL(imagePreviewRef.current);
    }
    imagePreviewRef.current = scan.imagePreview;
    setScanResult(scan);
  }

  async function identifyAndLookup(
    scan: ScanResult,
    minimumScore: number,
    reviewMessage: string,
    emptyMessage: string
  ) {
    applyScanResult(scan);
    const matches = identifyService.identifyFromScan(scan, manual);
    setCandidates(matches);

    if (matches[0]?.score >= minimumScore) {
      await lookupItem(matches[0].item);
      return;
    }

    const provisionalItem = buildProvisionalFunkoItem(scan.rawValue, manual);
    if (provisionalItem) {
      setCandidates([
        {
          item: provisionalItem,
          score: 0.5,
          reasons: [provisionalItem.upc ? 'Barcode lookup' : 'Manual marketplace lookup']
        },
        ...matches
      ]);
      await lookupItem(provisionalItem);
      return;
    }

    setSelectedItem(null);
    setValuation(null);
    setLoading('');
    setError(matches.length ? reviewMessage : emptyMessage);
  }

  async function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');
    setLoading('Scanning image for barcode signals...');

    try {
      const scan = await scanService.scanImage(file);
      await identifyAndLookup(
        scan,
        0.65,
        scan.rawValue
          ? 'Barcode read, but match confidence is low. Select the best possible match or refine manual details.'
          : 'No barcode found. Try a closer, well-lit photo or use manual details.',
        'No matches found from that image. Try manual details.'
      );
    } catch {
      setError('Could not read that image. Try another photo or use manual search.');
      setLoading('');
    }
  }

  async function handleManualSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setLoading('Searching possible Funko matches...');

    const query = identifyService.buildSearchQuery(manual);
    const scan = scanService.buildManualScan(query);
    await identifyAndLookup(
      scan,
      0.55,
      'Review possible matches before estimating value.',
      'No matches found. Add more details.'
    );
  }

  async function startCameraScan() {
    const video = videoRef.current;
    if (!video) return;

    setError('');
    setCameraActive(true);
    setLoading('Starting camera scanner...');
    let detected = false;

    try {
      const controls = await scanService.startCameraScan(video, (rawValue) => {
        detected = true;
        void handleCameraBarcode(rawValue);
      });
      cameraControlsRef.current = controls;
      if (!detected) setLoading('Point camera at the UPC barcode...');
    } catch {
      cameraControlsRef.current = null;
      setCameraActive(false);
      setLoading('');
      setError('Could not start the camera scanner. Check camera permission or upload a photo instead.');
    }
  }

  async function handleCameraBarcode(rawValue: string) {
    cameraControlsRef.current?.stop();
    cameraControlsRef.current = null;
    setCameraActive(false);
    setLoading('Barcode found. Matching Pop...');

    await identifyAndLookup(
      scanService.buildBarcodeScan(rawValue, 'camera'),
      0.65,
      'Barcode read, but match confidence is low. Select the best possible match or refine manual details.',
      'Barcode read, but no catalog match was found. Try manual details.'
    );
  }

  function stopCameraScan() {
    cameraControlsRef.current?.stop();
    cameraControlsRef.current = null;
    setCameraActive(false);
    setLoading((current) => (current === 'Point camera at the UPC barcode...' ? '' : current));
  }

  async function lookupItem(item: FunkoItem) {
    setLoading('Checking active listings and estimating value...');
    setError('');
    setSelectedItem(item);
    setCondition(item.condition);

    try {
      const [lookup, offers] = await Promise.all([ebayService.searchListings(item), retailService.compare(item)]);
      const estimate = valuationService.estimate(item, lookup.activeListings, lookup.soldListings);
      const enrichedItem = enrichItemImageFromListings(item, [
        ...estimate.listingsUsed,
        ...lookup.activeListings,
        ...lookup.soldListings
      ]);

      setSelectedItem(enrichedItem);
      setCandidates((current) =>
        current.map((candidate) =>
          candidate.item.id === item.id ? { ...candidate, item: enrichedItem } : candidate
        )
      );
      setValuation(estimate);
      setMarketMessages(lookup.messages);
      setRetailOffers(offers);
    } catch {
      setError('Lookup failed. Mock data is available, but the valuation service could not complete.');
    } finally {
      setLoading('');
    }
  }

  async function saveToCollection() {
    if (!selectedItem || !valuation) return;

    const existingEntry = findMatchingCollectionEntry(collection, selectedItem);
    if (
      existingEntry &&
      !window.confirm(
        'This Pop is already in your collection. Do you want to add another copy?'
      )
    ) {
      return;
    }

    const entry: CollectionEntry = {
      id: `${selectedItem.id}-${Date.now()}`,
      item: { ...selectedItem, condition },
      valuation,
      condition,
      notes: notes.trim(),
      purchasePrice: purchasePrice ? Number(purchasePrice) : undefined,
      savedAt: new Date().toISOString()
    };

    try {
      if (profileUser) {
        setCollection(await cloudCollectionService.save(profileUser.id, entry));
        setAuthMessage(existingEntry ? 'Added another copy to your profile.' : 'Saved to your profile.');
      } else {
        setCollection(collectionService.save(entry));
        setLocalCollectionCount(collectionService.list().length);
      }
      setError('');
    } catch {
      setError('Could not save that Pop to your collection. Try again.');
    }

    setNotes('');
    setPurchasePrice('');
  }

  async function updateCollectionEntry(id: string, patch: Partial<CollectionEntry>) {
    try {
      if (profileUser) {
        setCollection(await cloudCollectionService.update(profileUser.id, id, patch));
      } else {
        setCollection(collectionService.update(id, patch));
        setLocalCollectionCount(collectionService.list().length);
      }
    } catch {
      setError('Could not update that collection entry.');
    }
  }

  async function removeCollectionEntry(entry: CollectionEntry) {
    const label = `${entry.item.name}${entry.item.boxNumber ? ` #${entry.item.boxNumber}` : ''}`;
    if (!window.confirm(`Remove ${label} from your collection?`)) return;

    try {
      if (profileUser) {
        setCollection(await cloudCollectionService.remove(profileUser.id, entry.id));
      } else {
        setCollection(collectionService.remove(entry.id));
        setLocalCollectionCount(collectionService.list().length);
      }
    } catch {
      setError('Could not remove that collection entry.');
    }
  }

  function exportCollection() {
    const blob = new Blob([collectionService.exportJson(collection)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `popvalue-collection-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importCollection(file: File) {
    try {
      const contents = await file.text();
      if (profileUser) {
        setCollection(await cloudCollectionService.replace(profileUser.id, parseCollectionExport(contents)));
        setAuthMessage('Imported collection into your profile.');
      } else {
        setCollection(collectionService.importJson(contents));
        setLocalCollectionCount(collectionService.list().length);
      }
      setError('');
    } catch {
      setError('Could not import that collection file.');
    }
  }

  async function sendSignInLink(event: FormEvent) {
    event.preventDefault();
    const email = authEmail.trim();
    if (!email) return;

    setAuthLoading('Sending login link...');
    setAuthError('');
    setAuthMessage('');

    try {
      await authService.sendMagicLink(email);
      setAuthMessage('Check your email for the PopValue login link.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Check your Supabase Auth settings and try again.';
      setAuthError(`Could not send the login link. ${message}`);
    } finally {
      setAuthLoading('');
    }
  }

  async function signOutProfile() {
    setAuthLoading('Signing out...');
    setAuthError('');
    setAuthMessage('');

    try {
      await authService.signOut();
      setProfileUser(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Try again.';
      setAuthError(`Could not sign out. ${message}`);
    } finally {
      setAuthLoading('');
    }
  }

  async function moveLocalCollectionToProfile() {
    if (!profileUser) return;
    const localEntries = collectionService.list();
    if (!localEntries.length) return;

    setAuthLoading('Moving local collection to profile...');
    setAuthError('');
    setAuthMessage('');

    try {
      setCollection(await cloudCollectionService.merge(profileUser.id, localEntries));
      collectionService.replace([]);
      setLocalCollectionCount(0);
      setAuthMessage('Local collection moved to your profile.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Try again.';
      setAuthError(`Could not move the local collection into your profile. ${message}`);
    } finally {
      setAuthLoading('');
    }
  }

  async function savePublicProfile(event: FormEvent) {
    event.preventDefault();
    if (!profileUser) return;

    setAuthLoading('Saving public profile...');
    setAuthError('');
    setAuthMessage('');

    try {
      const avatarUrl = profileAvatarFile
        ? await cloudCollectionService.uploadProfileAvatar(profileUser.id, profileAvatarFile)
        : profileAvatarUrl;

      const profile = await cloudCollectionService.saveProfile(profileUser.id, {
        username: profileHandle,
        displayName: profileDisplayName,
        avatarUrl,
        bio: profileBio,
        collectionPublic: profilePublic
      });

      setProfileDetails(profile);
      setProfileHandle(profile?.username ?? '');
      setProfileDisplayName(profile?.displayName ?? profileDisplayName.trim());
      setProfileAvatarUrl(profile?.avatarUrl ?? '');
      clearProfileAvatarPreview();
      setProfileBio(profile?.bio ?? '');
      setAuthMessage(profile?.collectionPublic ? 'Public profile saved.' : 'Profile saved. Public lookup is off.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Try another profile name.';
      setAuthError(`Could not save public profile. ${message}`);
    } finally {
      setAuthLoading('');
    }
  }

  function clearProfileAvatarPreview() {
    if (profileAvatarPreviewRef.current) {
      URL.revokeObjectURL(profileAvatarPreviewRef.current);
      profileAvatarPreviewRef.current = undefined;
    }
    setProfileAvatarFile(null);
    setProfileAvatarPreview('');
  }

  function handleProfileAvatarSelect(file: File | null) {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setAuthError('Choose an image file for your profile photo.');
      return;
    }

    if (file.size > profileAvatarMaxBytes) {
      setAuthError('Profile photo must be under 5 MB.');
      return;
    }

    clearProfileAvatarPreview();
    const preview = URL.createObjectURL(file);
    profileAvatarPreviewRef.current = preview;
    setProfileAvatarFile(file);
    setProfileAvatarPreview(preview);
    setAuthError('');
    setAuthMessage('Profile photo selected. Save profile to upload it.');
  }

  function removeProfileAvatar() {
    clearProfileAvatarPreview();
    setProfileAvatarUrl('');
    setAuthMessage('Profile photo will be removed when you save profile.');
  }

  async function lookupPublicCollection(handleOverride?: string) {
    const handle = (handleOverride ?? profileLookup).trim();
    if (!handle) return;

    setPublicLookupLoading('Loading public collection...');
    setPublicLookupError('');

    try {
      const result = await cloudCollectionService.lookupPublicCollection(handle);
      if (!result) {
        setPublicProfile(null);
        setPublicCollection([]);
        setPublicLookupError('No public profile found for that name.');
        return;
      }

      setPublicProfile(result.profile);
      setPublicCollection(result.entries);
      setProfileLookup(result.profile.username);
      window.history.replaceState(null, '', publicProfilePath(result.profile.username));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Try again.';
      setPublicLookupError(`Could not load that public collection. ${message}`);
    } finally {
      setPublicLookupLoading('');
    }
  }

  function handlePublicLookupSubmit(event: FormEvent) {
    event.preventDefault();
    void lookupPublicCollection();
  }

  function clearPublicLookup() {
    setProfileLookup('');
    setPublicProfile(null);
    setPublicCollection([]);
    setPublicLookupError('');
    setPublicLookupLoading('');

    if (getPublicProfileHandleFromLocation()) window.history.replaceState(null, '', '/');
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">PopValue MVP</p>
          <h1>Estimated Value for Funko Pop collectors</h1>
          <p className="hero-copy">
            Scan a barcode, upload a box photo, or search manually. PopValue compares active eBay listings and retail
            references without claiming exact market value.
          </p>
        </div>
        <div className="hero-stat">
          <span>Collection Total</span>
          <strong>{formatCurrency(totalCollectionValue)}</strong>
          <small>{collection.length || 'No'} saved Pops</small>
        </div>
      </section>

      <div className="workspace">
        <section className="panel scanner-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Scan</p>
              <h2>Identify a Pop</h2>
            </div>
            {scanResult?.rawValue && <span className="pill">Signal: {scanResult.rawValue}</span>}
          </div>

          <label className="upload-zone">
            <input accept="image/*" capture="environment" type="file" onChange={handleImageUpload} />
            {scanResult?.imagePreview ? (
              <img src={scanResult.imagePreview} alt="Uploaded Funko box preview" />
            ) : (
              <div>
                <strong>Open camera or upload photo</strong>
                <span>Use a straight, well-lit UPC/EAN barcode photo for the fastest match.</span>
              </div>
            )}
          </label>
          <video
            aria-hidden={!cameraActive}
            className={`camera-preview ${cameraActive ? 'active' : ''}`}
            muted
            playsInline
            ref={videoRef}
          />
          {cameraActive && (
            <div className="scanner-guidance" aria-live="polite">
              <span className="scanner-frame" />
              <div>
                <strong>Center the UPC barcode</strong>
                <small>Hold steady, fill the frame, and use a well-lit box edge.</small>
              </div>
            </div>
          )}
          <div className="scan-actions">
            <button className="secondary-button" onClick={cameraActive ? stopCameraScan : startCameraScan} type="button">
              {cameraActive ? 'Stop Camera' : 'Scan Barcode'}
            </button>
          </div>

          <form className="manual-form" onSubmit={handleManualSubmit}>
            <div className="field-row">
              <label>
                Name
                <input value={manual.name} onChange={(event) => setManual({ ...manual, name: event.target.value })} />
              </label>
              <label>
                Franchise
                <input
                  value={manual.franchise}
                  onChange={(event) => setManual({ ...manual, franchise: event.target.value })}
                />
              </label>
            </div>
            <div className="field-row">
              <label>
                Series
                <input value={manual.series} onChange={(event) => setManual({ ...manual, series: event.target.value })} />
              </label>
              <label>
                Number
                <input
                  value={manual.boxNumber}
                  onChange={(event) => setManual({ ...manual, boxNumber: event.target.value })}
                />
              </label>
            </div>
            <label>
              Variant / sticker / exclusive
              <input
                value={manual.variant}
                onChange={(event) => setManual({ ...manual, variant: event.target.value })}
                placeholder="Chase, glow, convention sticker..."
              />
            </label>
            <button className="primary-button" type="submit">
              Search Estimated Value
            </button>
          </form>

          {loading && <StateBanner tone="loading" message={loading} />}
          {error && <StateBanner tone="error" message={error} />}
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Matches</p>
              <h2>Possible figures</h2>
            </div>
          </div>
          {candidates.length ? (
            <div className="candidate-list">
              {candidates.map((candidate) => (
                <button
                  className={`candidate ${selectedItem?.id === candidate.item.id ? 'selected' : ''}`}
                  key={candidate.item.id}
                  onClick={() => lookupItem(candidate.item)}
                  type="button"
                >
                  <FigureImage src={candidate.item.imageUrl} alt={candidate.item.name} />
                  <span>
                    <strong>
                      {candidate.item.name} {candidate.item.boxNumber ? `#${candidate.item.boxNumber}` : ''}
                    </strong>
                    <small>
                      {candidate.item.franchise} - {Math.round(candidate.score * 100)}% match
                    </small>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState title="No matches yet" body="Scan a box or enter manual details to see possible matches." />
          )}
        </section>
      </div>

      <section className="results-grid">
        <div className="results-stack">
          <ResultsPanel
            condition={condition}
            duplicateEntry={duplicateEntry}
            onConditionChange={setCondition}
            onSave={saveToCollection}
            purchasePrice={purchasePrice}
            retailOffers={retailOffers}
            selectedItem={selectedItem}
            marketMessages={marketMessages}
            setNotes={setNotes}
            setPurchasePrice={setPurchasePrice}
            notes={notes}
            valuation={valuation}
          />
          {isCollectionOpen && (
            <CollectionModal
              collection={collection}
              onClose={() => setCollectionOpen(false)}
              onRemove={removeCollectionEntry}
              onUpdate={updateCollectionEntry}
              total={totalCollectionValue}
            />
          )}
        </div>
        <CollectionPanel
          authEmail={authEmail}
          authError={authError}
          authLoading={authLoading}
          authMessage={authMessage}
          collection={collection}
          isAuthConfigured={authService.configured}
          isCollectionOpen={isCollectionOpen}
          localCollectionCount={localCollectionCount}
          onAuthEmailChange={setAuthEmail}
          onExport={exportCollection}
          onImport={importCollection}
          onMoveLocalCollection={moveLocalCollectionToProfile}
          onProfileBioChange={setProfileBio}
          onProfileDisplayNameChange={setProfileDisplayName}
          onProfileHandleChange={setProfileHandle}
          onProfilePublicChange={setProfilePublic}
          onProfileAvatarRemove={removeProfileAvatar}
          onProfileAvatarSelect={handleProfileAvatarSelect}
          onPublicLookupChange={setProfileLookup}
          onPublicLookupClear={clearPublicLookup}
          onPublicLookupSubmit={handlePublicLookupSubmit}
          onSavePublicProfile={savePublicProfile}
          onSignIn={sendSignInLink}
          onSignOut={signOutProfile}
          onToggleCollection={() => setCollectionOpen((current) => !current)}
          profileDetails={profileDetails}
          profileAvatarFile={profileAvatarFile}
          profileAvatarPreview={profileAvatarPreview}
          profileAvatarUrl={profileAvatarUrl}
          profileBio={profileBio}
          profileDisplayName={profileDisplayName}
          profileHandle={profileHandle}
          profilePublic={profilePublic}
          profileShareUrl={profileShareUrl}
          publicCollection={publicCollection}
          publicCollectionValue={publicCollectionValue}
          publicLookup={profileLookup}
          publicLookupError={publicLookupError}
          publicLookupLoading={publicLookupLoading}
          publicProfile={publicProfile}
          profileUser={profileUser}
          total={totalCollectionValue}
        />
      </section>
    </main>
  );
}

function StateBanner({ tone, message }: { tone: 'loading' | 'error'; message: string }) {
  return <div className={`state-banner ${tone}`}>{message}</div>;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <span>{body}</span>
    </div>
  );
}

function ResultsPanel({
  condition,
  duplicateEntry,
  onConditionChange,
  onSave,
  purchasePrice,
  retailOffers,
  selectedItem,
  marketMessages,
  setNotes,
  setPurchasePrice,
  notes,
  valuation
}: {
  condition: Condition;
  duplicateEntry?: CollectionEntry;
  onConditionChange: (condition: Condition) => void;
  onSave: () => void;
  purchasePrice: string;
  retailOffers: RetailOffer[];
  selectedItem: FunkoItem | null;
  marketMessages: string[];
  setNotes: (notes: string) => void;
  setPurchasePrice: (price: string) => void;
  notes: string;
  valuation: ValuationResult | null;
}) {
  return (
    <section className="panel results-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Results</p>
          <h2>Estimated Value</h2>
        </div>
        {valuation && <span className={`confidence ${valuation.confidence}`}>{valuation.confidence}</span>}
      </div>

      {selectedItem && valuation ? (
        <>
          <div className="product-hero">
            <FigureImage src={selectedItem.imageUrl} alt={selectedItem.name} />
            <div>
              <h3>
                {selectedItem.name} {selectedItem.boxNumber ? `#${selectedItem.boxNumber}` : ''}
              </h3>
              <p>
                {selectedItem.franchise} - {selectedItem.series}
              </p>
              <div className="tag-row">
                {selectedItem.variant && <span>{selectedItem.variant}</span>}
                {selectedItem.sticker && <span>{selectedItem.sticker}</span>}
                {selectedItem.upc && <span>UPC {selectedItem.upc}</span>}
              </div>
            </div>
          </div>

          <div className="value-band">
            <span>Estimated Value Range</span>
            <strong>
              {formatCurrency(valuation.estimatedLow)} - {formatCurrency(valuation.estimatedHigh)}
            </strong>
            <small>Median active eBay price: {formatCurrency(valuation.medianPrice)}</small>
          </div>

          <div className="metric-grid">
            <Metric label="Lowest active listing" value={valuation.lowestListing ? formatCurrency(valuation.lowestListing.price + valuation.lowestListing.shipping) : 'N/A'} />
            <Metric label="Value basis" value={valuation.basis} />
            <Metric label="Confidence score" value={`${Math.round(valuation.confidenceScore * 100)}%`} />
          </div>

          <div className="metric-grid secondary-metrics">
            <Metric label="Active median" value={formatCurrency(valuation.activeMedianPrice)} />
            <Metric label="Sold comp median" value={valuation.soldMedianPrice ? formatCurrency(valuation.soldMedianPrice) : 'N/A'} />
            <Metric label="Samples" value={`${valuation.activeSampleSize} active / ${valuation.soldSampleSize} sold`} />
          </div>

          <ValuationTrustPanel valuation={valuation} />

          <div className="disclaimer">
            Prices are estimates. Condition, stickers, exclusives, and rarity affect value.
          </div>

          {[...valuation.notes, ...marketMessages].map((message) => (
            <div className="note" key={message}>
              {message}
            </div>
          ))}

          <div className="subsection">
            <h3>Sample listings used</h3>
            <div className="listing-list">
              {valuation.listingsUsed.map((listing) => (
                <a className="listing" href={listing.url} key={listing.id} rel="noreferrer" target="_blank">
                  <FigureImage src={listing.imageUrl || selectedItem.imageUrl} alt="" />
                  <span>
                    <strong>{listing.title}</strong>
                    <small>
                      {formatCurrency(listing.price + listing.shipping)} - {listing.condition} - {listing.listingType}
                      {listing.soldAt ? ` - sold ${new Date(listing.soldAt).toLocaleDateString()}` : ''}
                    </small>
                  </span>
                </a>
              ))}
            </div>
          </div>

          <div className="subsection">
            <h3>Retail comparisons</h3>
            <div className="retail-grid">
              {retailOffers.map((offer) => (
                <a href={offer.url} key={offer.provider} rel="noreferrer" target="_blank">
                  <strong>{offer.provider}</strong>
                  <span>{formatCurrency(offer.price)}</span>
                  <small>
                    {offer.availability} - {offer.providerType === 'search-link' ? 'opens search' : 'mock price'}
                  </small>
                </a>
              ))}
            </div>
          </div>

          <div className="save-card">
            <h3>Save to My Collection</h3>
            {duplicateEntry && (
              <div className="note">
                Already saved on {new Date(duplicateEntry.savedAt).toLocaleDateString()}. Saving will ask before
                adding another copy.
              </div>
            )}
            <div className="field-row">
              <label>
                Condition
                <select value={condition} onChange={(event) => onConditionChange(event.target.value as Condition)}>
                  <option value="mint">Mint</option>
                  <option value="good">Good</option>
                  <option value="damaged">Damaged</option>
                  <option value="out of box">Out of box</option>
                </select>
              </label>
              <label>
                Purchase price
                <input
                  inputMode="decimal"
                  onChange={(event) => setPurchasePrice(event.target.value)}
                  placeholder="0.00"
                  value={purchasePrice}
                />
              </label>
            </div>
            <label>
              Notes
              <textarea onChange={(event) => setNotes(event.target.value)} value={notes} />
            </label>
            <button className="primary-button" onClick={onSave} type="button">
              {duplicateEntry ? 'Add Another Copy' : 'Add to Collection'}
            </button>
          </div>
        </>
      ) : (
        <EmptyState title="No valuation yet" body="Choose a match to calculate an Estimated Value from listings." />
      )}
    </section>
  );
}

function ValuationTrustPanel({ valuation }: { valuation: ValuationResult }) {
  const excludedCount = valuation.excludedListingCount ?? 0;
  const relevantCount = valuation.relevantListingCount ?? valuation.activeSampleSize + valuation.soldSampleSize;

  return (
    <div className="trust-panel">
      <div>
        <strong>Estimate quality</strong>
        <span>{valuation.basis === 'sold comps' ? 'Prioritizes completed sale data.' : 'Uses active asking prices until enough sold comps are available.'}</span>
      </div>
      <div className="trust-grid">
        <Metric label="Relevant listings" value={`${relevantCount}`} />
        <Metric label="Filtered out" value={`${excludedCount}`} />
        <Metric label="Range buffer" value="12%" />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function FigureImage({ alt, src }: { alt: string; src?: string }) {
  return (
    <img
      alt={alt}
      loading="lazy"
      onError={fallbackImage}
      referrerPolicy="no-referrer"
      src={src || fallbackImageUrl}
    />
  );
}

function ProfileAvatar({ profile }: { profile: Partial<PublicProfile> | null }) {
  const label = profile?.displayName || profile?.username || 'Profile';
  const initials = label
    .split(/\s+|-/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return profile?.avatarUrl ? (
    <img
      alt={label}
      className="profile-avatar"
      loading="lazy"
      onError={fallbackImage}
      referrerPolicy="no-referrer"
      src={profile.avatarUrl}
    />
  ) : (
    <span className="profile-avatar">{initials || '@'}</span>
  );
}

function ProfileCard({
  authEmail,
  authError,
  authLoading,
  authMessage,
  isAuthConfigured,
  localCollectionCount,
  onAuthEmailChange,
  onMoveLocalCollection,
  onProfileBioChange,
  onProfileDisplayNameChange,
  onProfileHandleChange,
  onProfilePublicChange,
  onProfileAvatarRemove,
  onProfileAvatarSelect,
  onSavePublicProfile,
  onSignIn,
  onSignOut,
  profileDetails,
  profileAvatarFile,
  profileAvatarPreview,
  profileAvatarUrl,
  profileBio,
  profileDisplayName,
  profileHandle,
  profilePublic,
  profileShareUrl,
  profileUser
}: {
  authEmail: string;
  authError: string;
  authLoading: string;
  authMessage: string;
  isAuthConfigured: boolean;
  localCollectionCount: number;
  onAuthEmailChange: (email: string) => void;
  onMoveLocalCollection: () => void;
  onProfileBioChange: (bio: string) => void;
  onProfileDisplayNameChange: (name: string) => void;
  onProfileHandleChange: (handle: string) => void;
  onProfilePublicChange: (isPublic: boolean) => void;
  onProfileAvatarRemove: () => void;
  onProfileAvatarSelect: (file: File | null) => void;
  onSavePublicProfile: (event: FormEvent) => void;
  onSignIn: (event: FormEvent) => void;
  onSignOut: () => void;
  profileDetails: PublicProfile | null;
  profileAvatarFile: File | null;
  profileAvatarPreview: string;
  profileAvatarUrl: string;
  profileBio: string;
  profileDisplayName: string;
  profileHandle: string;
  profilePublic: boolean;
  profileShareUrl: string;
  profileUser: ProfileUser | null;
}) {
  return (
    <div className="profile-card">
      <div className="profile-card-header">
        <div>
          <strong>Profile</strong>
          <span>{profileUser?.email ?? (isAuthConfigured ? 'Signed out' : 'Supabase setup needed')}</span>
        </div>
        {profileUser && (
          <button className="secondary-button compact" disabled={Boolean(authLoading)} onClick={onSignOut} type="button">
            Sign out
          </button>
        )}
      </div>

      {!isAuthConfigured ? (
        <p>Add Supabase env vars to enable profile-synced collections.</p>
      ) : profileUser ? (
        <>
          <div className="profile-identity">
            <ProfileAvatar
              profile={{
                avatarUrl: profileAvatarPreview || profileAvatarUrl,
                displayName: profileDisplayName,
                username: profileDetails?.username ?? profileHandle
              }}
            />
            <div>
              <strong>{profileDisplayName.trim() || profileDetails?.username || 'Your public profile'}</strong>
              <span>@{profileDetails?.username ?? (profileHandle || 'profile-name')}</span>
            </div>
          </div>
          <p>Saved Pops sync to this profile across devices.</p>
          <form className="profile-handle-form" onSubmit={onSavePublicProfile}>
            <label>
              Display name
              <input
                autoComplete="name"
                onChange={(event) => onProfileDisplayNameChange(event.target.value)}
                placeholder="Bradley's Pops"
                value={profileDisplayName}
              />
            </label>
            <label>
              Public profile name
              <input
                autoComplete="off"
                onChange={(event) => onProfileHandleChange(event.target.value)}
                placeholder="bradley-pops"
                value={profileHandle}
              />
            </label>
            <div className="profile-upload-field">
              <span className="field-label">Profile photo</span>
              <div className="profile-upload-row">
                <ProfileAvatar
                  profile={{
                    avatarUrl: profileAvatarPreview || profileAvatarUrl,
                    displayName: profileDisplayName,
                    username: profileDetails?.username ?? profileHandle
                  }}
                />
                <label className="import-button avatar-upload-button">
                  Upload image
                  <input
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    type="file"
                    onChange={(event) => {
                      onProfileAvatarSelect(event.target.files?.[0] ?? null);
                      event.target.value = '';
                    }}
                  />
                </label>
                {(profileAvatarPreview || profileAvatarUrl) && (
                  <button className="secondary-button compact" onClick={onProfileAvatarRemove} type="button">
                    Remove
                  </button>
                )}
              </div>
              <small>
                {profileAvatarFile ? `${profileAvatarFile.name} selected. Save profile to upload.` : 'PNG, JPG, WebP, or GIF up to 5 MB.'}
              </small>
            </div>
            <label>
              Bio
              <textarea
                maxLength={180}
                onChange={(event) => onProfileBioChange(event.target.value)}
                placeholder="Anime, Marvel, grails, chases..."
                value={profileBio}
              />
            </label>
            <label className="profile-toggle">
              <input
                checked={profilePublic}
                onChange={(event) => onProfilePublicChange(event.target.checked)}
                type="checkbox"
              />
              Public collection lookup
            </label>
            <button className="primary-button compact" disabled={Boolean(authLoading)} type="submit">
              Save profile
            </button>
          </form>
          {profileDetails?.username && profileShareUrl && (
            <p>
              Share: <span className="profile-link">{profileShareUrl}</span>
            </p>
          )}
          {localCollectionCount > 0 && (
            <button
              className="secondary-button compact"
              disabled={Boolean(authLoading)}
              onClick={onMoveLocalCollection}
              type="button"
            >
              Move {localCollectionCount} local save{localCollectionCount === 1 ? '' : 's'} to profile
            </button>
          )}
        </>
      ) : (
        <form className="profile-form" onSubmit={onSignIn}>
          <input
            autoComplete="email"
            inputMode="email"
            onChange={(event) => onAuthEmailChange(event.target.value)}
            placeholder="email@example.com"
            type="email"
            value={authEmail}
          />
          <button className="primary-button compact" disabled={Boolean(authLoading)} type="submit">
            Send link
          </button>
        </form>
      )}

      {authError && <small className="profile-error">{authError}</small>}
      {(authLoading || authMessage) && <small>{authLoading || authMessage}</small>}
    </div>
  );
}

function PublicCollectionLookup({
  onPublicLookupChange,
  onPublicLookupClear,
  onPublicLookupSubmit,
  publicCollection,
  publicCollectionValue,
  publicLookup,
  publicLookupError,
  publicLookupLoading,
  publicProfile
}: {
  onPublicLookupChange: (handle: string) => void;
  onPublicLookupClear: () => void;
  onPublicLookupSubmit: (event: FormEvent) => void;
  publicCollection: CollectionEntry[];
  publicCollectionValue: number;
  publicLookup: string;
  publicLookupError: string;
  publicLookupLoading: string;
  publicProfile: PublicProfile | null;
}) {
  const hasLookupState = Boolean(
    publicLookup || publicProfile || publicCollection.length || publicLookupError || publicLookupLoading
  );

  return (
    <div className="profile-card public-lookup-card">
      <div className="profile-card-header">
        <div>
          <strong>Profile Lookup</strong>
          <span>View another public collection</span>
        </div>
        {hasLookupState && (
          <button className="secondary-button compact" onClick={onPublicLookupClear} type="button">
            Clear
          </button>
        )}
      </div>

      <form className="profile-form" onSubmit={onPublicLookupSubmit}>
        <input
          autoComplete="off"
          onChange={(event) => onPublicLookupChange(event.target.value)}
          placeholder="@profile-name"
          value={publicLookup}
        />
        <button className="secondary-button compact" disabled={Boolean(publicLookupLoading)} type="submit">
          View
        </button>
      </form>

      {publicLookupError && <small className="profile-error">{publicLookupError}</small>}
      {publicLookupLoading && <small>{publicLookupLoading}</small>}

      {publicProfile && (
        <div className="public-collection">
          <div className="public-collection-heading">
            <div className="profile-identity">
              <ProfileAvatar profile={publicProfile} />
              <div>
                <strong>{publicProfile.displayName || `@${publicProfile.username}`}</strong>
                <span>@{publicProfile.username}</span>
              </div>
            </div>
            <span>
              {formatCurrency(publicCollectionValue)} - {publicCollection.length} saved
            </span>
            {publicProfile.bio && <small>{publicProfile.bio}</small>}
          </div>
          {publicCollection.length ? (
            <div className="public-collection-list">
              {publicCollection.map((entry) => (
                <article className="public-entry" key={entry.id}>
                  <FigureImage src={entry.item.imageUrl} alt={entry.item.name} />
                  <span>
                    <strong>
                      {entry.item.name} {entry.item.boxNumber ? `#${entry.item.boxNumber}` : ''}
                    </strong>
                    <small>{formatCurrency(entry.valuation.medianPrice)} estimated median</small>
                  </span>
                </article>
              ))}
            </div>
          ) : (
            <small>This public collection is empty.</small>
          )}
        </div>
      )}
    </div>
  );
}

function CollectionPanel({
  authEmail,
  authError,
  authLoading,
  authMessage,
  collection,
  isAuthConfigured,
  isCollectionOpen,
  localCollectionCount,
  onAuthEmailChange,
  onExport,
  onImport,
  onMoveLocalCollection,
  onProfileBioChange,
  onProfileDisplayNameChange,
  onProfileHandleChange,
  onProfilePublicChange,
  onProfileAvatarRemove,
  onProfileAvatarSelect,
  onPublicLookupChange,
  onPublicLookupClear,
  onPublicLookupSubmit,
  onSavePublicProfile,
  onSignIn,
  onSignOut,
  onToggleCollection,
  profileDetails,
  profileAvatarFile,
  profileAvatarPreview,
  profileAvatarUrl,
  profileBio,
  profileDisplayName,
  profileHandle,
  profilePublic,
  profileShareUrl,
  publicCollection,
  publicCollectionValue,
  publicLookup,
  publicLookupError,
  publicLookupLoading,
  publicProfile,
  profileUser,
  total
}: {
  authEmail: string;
  authError: string;
  authLoading: string;
  authMessage: string;
  collection: CollectionEntry[];
  isAuthConfigured: boolean;
  isCollectionOpen: boolean;
  localCollectionCount: number;
  onAuthEmailChange: (email: string) => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onMoveLocalCollection: () => void;
  onProfileBioChange: (bio: string) => void;
  onProfileDisplayNameChange: (name: string) => void;
  onProfileHandleChange: (handle: string) => void;
  onProfilePublicChange: (isPublic: boolean) => void;
  onProfileAvatarRemove: () => void;
  onProfileAvatarSelect: (file: File | null) => void;
  onPublicLookupChange: (handle: string) => void;
  onPublicLookupClear: () => void;
  onPublicLookupSubmit: (event: FormEvent) => void;
  onSavePublicProfile: (event: FormEvent) => void;
  onSignIn: (event: FormEvent) => void;
  onSignOut: () => void;
  onToggleCollection: () => void;
  profileDetails: PublicProfile | null;
  profileAvatarFile: File | null;
  profileAvatarPreview: string;
  profileAvatarUrl: string;
  profileBio: string;
  profileDisplayName: string;
  profileHandle: string;
  profilePublic: boolean;
  profileShareUrl: string;
  publicCollection: CollectionEntry[];
  publicCollectionValue: number;
  publicLookup: string;
  publicLookupError: string;
  publicLookupLoading: string;
  publicProfile: PublicProfile | null;
  profileUser: ProfileUser | null;
  total: number;
}) {
  return (
    <section className="panel collection-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">My Collection</p>
          <h2>{formatCurrency(total)}</h2>
        </div>
        <span className="pill">{collection.length} saved</span>
      </div>

      <ProfileCard
        authEmail={authEmail}
        authError={authError}
        authLoading={authLoading}
        authMessage={authMessage}
        isAuthConfigured={isAuthConfigured}
        localCollectionCount={localCollectionCount}
        onAuthEmailChange={onAuthEmailChange}
        onMoveLocalCollection={onMoveLocalCollection}
        onProfileBioChange={onProfileBioChange}
        onProfileDisplayNameChange={onProfileDisplayNameChange}
        onProfileHandleChange={onProfileHandleChange}
        onProfilePublicChange={onProfilePublicChange}
        onProfileAvatarRemove={onProfileAvatarRemove}
        onProfileAvatarSelect={onProfileAvatarSelect}
        onSavePublicProfile={onSavePublicProfile}
        onSignIn={onSignIn}
        onSignOut={onSignOut}
        profileDetails={profileDetails}
        profileAvatarFile={profileAvatarFile}
        profileAvatarPreview={profileAvatarPreview}
        profileAvatarUrl={profileAvatarUrl}
        profileBio={profileBio}
        profileDisplayName={profileDisplayName}
        profileHandle={profileHandle}
        profilePublic={profilePublic}
        profileShareUrl={profileShareUrl}
        profileUser={profileUser}
      />

      <PublicCollectionLookup
        onPublicLookupChange={onPublicLookupChange}
        onPublicLookupClear={onPublicLookupClear}
        onPublicLookupSubmit={onPublicLookupSubmit}
        publicCollection={publicCollection}
        publicCollectionValue={publicCollectionValue}
        publicLookup={publicLookup}
        publicLookupError={publicLookupError}
        publicLookupLoading={publicLookupLoading}
        publicProfile={publicProfile}
      />

      <div className="collection-actions">
        <button className="primary-button" disabled={!collection.length} onClick={onToggleCollection} type="button">
          {isCollectionOpen ? 'Hide Collection' : 'View Collection'}
        </button>
        <button className="secondary-button" disabled={!collection.length} onClick={onExport} type="button">
          Export
        </button>
        <label className="import-button">
          Import
          <input
            accept="application/json"
            type="file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onImport(file);
            }}
          />
        </label>
      </div>

      {collection.length ? (
        <div className="collection-summary">
          <strong>{collection.length} saved Pops</strong>
          <span>Open the collection popup to edit condition, notes, or remove items.</span>
        </div>
      ) : (
        <EmptyState title="Collection is empty" body="Save estimated Pops here to track total collection value." />
      )}
    </section>
  );
}

function CollectionModal({
  collection,
  onClose,
  onRemove,
  onUpdate,
  total
}: {
  collection: CollectionEntry[];
  onClose: () => void;
  onRemove: (entry: CollectionEntry) => void;
  onUpdate: (id: string, patch: Partial<CollectionEntry>) => void;
  total: number;
}) {
  const [query, setQuery] = useState('');
  const [conditionFilter, setConditionFilter] = useState<Condition | 'all'>('all');
  const [franchiseFilter, setFranchiseFilter] = useState('all');
  const [sort, setSort] = useState<CollectionSort>('saved-desc');
  const [viewMode, setViewMode] = useState<CollectionViewMode>('cards');

  const franchises = useMemo(
    () =>
      Array.from(new Set(collection.map((entry) => entry.item.franchise).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [collection]
  );

  const visibleCollection = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = collection.filter((entry) => {
      const searchable = [
        entry.item.name,
        entry.item.franchise,
        entry.item.series,
        entry.item.boxNumber,
        entry.item.variant,
        entry.item.sticker,
        entry.item.upc,
        entry.notes,
        collectionItemKey(entry.item)
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return (
        (!normalizedQuery || searchable.includes(normalizedQuery)) &&
        (conditionFilter === 'all' || entry.condition === conditionFilter) &&
        (franchiseFilter === 'all' || entry.item.franchise === franchiseFilter)
      );
    });

    return [...filtered].sort((a, b) => {
      if (sort === 'saved-desc') return new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime();
      if (sort === 'saved-asc') return new Date(a.savedAt).getTime() - new Date(b.savedAt).getTime();
      if (sort === 'value-desc') return b.valuation.medianPrice - a.valuation.medianPrice;
      if (sort === 'value-asc') return a.valuation.medianPrice - b.valuation.medianPrice;
      if (sort === 'franchise-asc') return a.item.franchise.localeCompare(b.item.franchise);
      return a.item.name.localeCompare(b.item.name);
    });
  }, [collection, conditionFilter, franchiseFilter, query, sort]);

  return (
    <section aria-labelledby="collection-modal-title" className="collection-modal" role="region">
      <div className="modal-heading">
        <div>
          <p className="eyebrow">My Collection</p>
          <h2 id="collection-modal-title">{formatCurrency(total)}</h2>
          <small>
            {visibleCollection.length} shown / {collection.length} saved Pop{collection.length === 1 ? '' : 's'}
          </small>
        </div>
        <button className="secondary-button compact" onClick={onClose} type="button">
          Close
        </button>
      </div>

      <div className="collection-toolbar">
        <input
          aria-label="Search collection"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search collection"
          value={query}
        />
        <select
          aria-label="Filter by condition"
          onChange={(event) => setConditionFilter(event.target.value as Condition | 'all')}
          value={conditionFilter}
        >
          <option value="all">All conditions</option>
          {Object.entries(conditionLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by franchise"
          onChange={(event) => setFranchiseFilter(event.target.value)}
          value={franchiseFilter}
        >
          <option value="all">All franchises</option>
          {franchises.map((franchise) => (
            <option key={franchise} value={franchise}>
              {franchise}
            </option>
          ))}
        </select>
        <select aria-label="Sort collection" onChange={(event) => setSort(event.target.value as CollectionSort)} value={sort}>
          {Object.entries(sortLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <div className="segmented-control" aria-label="Collection view mode">
          <button
            className={viewMode === 'cards' ? 'active' : ''}
            onClick={() => setViewMode('cards')}
            type="button"
          >
            Cards
          </button>
          <button
            className={viewMode === 'compact' ? 'active' : ''}
            onClick={() => setViewMode('compact')}
            type="button"
          >
            Compact
          </button>
        </div>
      </div>

      {visibleCollection.length ? (
        viewMode === 'cards' ? (
          <div className="collection-grid modal-collection-grid">
            {visibleCollection.map((entry) => (
              <article className="collection-card" key={entry.id}>
                <FigureImage src={entry.item.imageUrl} alt={entry.item.name} />
                <div>
                  <div className="collection-card-header">
                    <h3>
                      {entry.item.name} {entry.item.boxNumber ? `#${entry.item.boxNumber}` : ''}
                    </h3>
                    <button
                      aria-label={`Remove ${entry.item.name} from collection`}
                      className="remove-button"
                      onClick={() => onRemove(entry)}
                      type="button"
                    >
                      Remove
                    </button>
                  </div>
                  <p>{formatCurrency(entry.valuation.medianPrice)} estimated median</p>
                  <select
                    value={entry.condition}
                    onChange={(event) => onUpdate(entry.id, { condition: event.target.value as Condition })}
                  >
                    {Object.entries(conditionLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <textarea
                    onBlur={(event) => onUpdate(entry.id, { notes: event.target.value })}
                    placeholder="Notes"
                    defaultValue={entry.notes}
                  />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="collection-compact-list modal-collection-grid">
            {visibleCollection.map((entry) => (
              <article className="collection-compact-entry" key={entry.id}>
                <FigureImage src={entry.item.imageUrl} alt={entry.item.name} />
                <div>
                  <strong>
                    {entry.item.name} {entry.item.boxNumber ? `#${entry.item.boxNumber}` : ''}
                  </strong>
                  <small>
                    {entry.item.franchise} - {formatCurrency(entry.valuation.medianPrice)} - {conditionLabels[entry.condition]}
                  </small>
                </div>
                <select
                  value={entry.condition}
                  onChange={(event) => onUpdate(entry.id, { condition: event.target.value as Condition })}
                >
                  {Object.entries(conditionLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <button
                  aria-label={`Remove ${entry.item.name} from collection`}
                  className="remove-button"
                  onClick={() => onRemove(entry)}
                  type="button"
                >
                  Remove
                </button>
              </article>
            ))}
          </div>
        )
      ) : (
        <EmptyState title="No saved Pops match" body="Clear filters or search another name, number, or franchise." />
      )}
    </section>
  );
}

export default App;
