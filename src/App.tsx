import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type {
  CollectionEntry,
  Condition,
  FunkoItem,
  IdentificationCandidate,
  ManualSearchFields,
  RetailOffer,
  ScanResult,
  ValuationResult
} from './types';
import { collectionService } from './services/collectionService';
import { ebayService } from './services/ebayService';
import { identifyService } from './services/identifyService';
import { retailService } from './services/retailService';
import { scanService } from './services/scanService';
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

function App() {
  const [manual, setManual] = useState<ManualSearchFields>(emptyManual);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [candidates, setCandidates] = useState<IdentificationCandidate[]>([]);
  const [selectedItem, setSelectedItem] = useState<FunkoItem | null>(null);
  const [valuation, setValuation] = useState<ValuationResult | null>(null);
  const [retailOffers, setRetailOffers] = useState<RetailOffer[]>([]);
  const [collection, setCollection] = useState<CollectionEntry[]>(() => collectionService.list());
  const [notes, setNotes] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [condition, setCondition] = useState<Condition>('mint');
  const [marketMessages, setMarketMessages] = useState<string[]>([]);
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');
  const imagePreviewRef = useRef<string | undefined>(undefined);

  const totalCollectionValue = useMemo(() => collectionService.totalEstimatedValue(collection), [collection]);

  useEffect(() => {
    return () => {
      if (imagePreviewRef.current) URL.revokeObjectURL(imagePreviewRef.current);
    };
  }, []);

  function applyScanResult(scan: ScanResult) {
    if (imagePreviewRef.current && imagePreviewRef.current !== scan.imagePreview) {
      URL.revokeObjectURL(imagePreviewRef.current);
    }
    imagePreviewRef.current = scan.imagePreview;
    setScanResult(scan);
  }

  async function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');
    setLoading('Scanning image for barcode signals...');

    try {
      const scan = await scanService.scanImage(file);
      applyScanResult(scan);
      const matches = identifyService.identifyFromScan(scan, manual);
      setCandidates(matches);

      if (matches[0]?.score >= 0.65) {
        await lookupItem(matches[0].item);
      } else {
        setSelectedItem(null);
        setValuation(null);
        setLoading('');
        setError('Low confidence scan. Select the best possible match or refine manual details.');
      }
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
    applyScanResult(scan);
    const matches = identifyService.identifyFromScan(scan, manual);
    setCandidates(matches);

    if (matches[0]?.score >= 0.55) {
      await lookupItem(matches[0].item);
    } else {
      setSelectedItem(null);
      setValuation(null);
      setLoading('');
      setError(matches.length ? 'Review possible matches before estimating value.' : 'No matches found. Add more details.');
    }
  }

  async function lookupItem(item: FunkoItem) {
    setLoading('Checking active listings and estimating value...');
    setError('');
    setSelectedItem(item);
    setCondition(item.condition);

    try {
      const [lookup, offers] = await Promise.all([ebayService.searchListings(item), retailService.compare(item)]);
      setValuation(valuationService.estimate(item, lookup.activeListings, lookup.soldListings));
      setMarketMessages(lookup.messages);
      setRetailOffers(offers);
    } catch {
      setError('Lookup failed. Mock data is available, but the valuation service could not complete.');
    } finally {
      setLoading('');
    }
  }

  function saveToCollection() {
    if (!selectedItem || !valuation) return;

    const entry: CollectionEntry = {
      id: `${selectedItem.id}-${Date.now()}`,
      item: { ...selectedItem, condition },
      valuation,
      condition,
      notes,
      purchasePrice: purchasePrice ? Number(purchasePrice) : undefined,
      savedAt: new Date().toISOString()
    };

    setCollection(collectionService.save(entry));
    setNotes('');
    setPurchasePrice('');
  }

  function updateCollectionEntry(id: string, patch: Partial<CollectionEntry>) {
    setCollection(collectionService.update(id, patch));
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
      setCollection(collectionService.importJson(contents));
      setError('');
    } catch {
      setError('Could not import that collection file.');
    }
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
                <span>Barcode detection uses the browser when available.</span>
              </div>
            )}
          </label>

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
                  <img src={candidate.item.imageUrl} alt={candidate.item.name} />
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
        <ResultsPanel
          condition={condition}
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
        <CollectionPanel
          collection={collection}
          onExport={exportCollection}
          onImport={importCollection}
          onUpdate={updateCollectionEntry}
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
            <img src={selectedItem.imageUrl} alt={selectedItem.name} />
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
                  <img src={listing.imageUrl || selectedItem.imageUrl} alt="" />
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
              Add to Collection
            </button>
          </div>
        </>
      ) : (
        <EmptyState title="No valuation yet" body="Choose a match to calculate an Estimated Value from listings." />
      )}
    </section>
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

function CollectionPanel({
  collection,
  onExport,
  onImport,
  onUpdate,
  total
}: {
  collection: CollectionEntry[];
  onExport: () => void;
  onImport: (file: File) => void;
  onUpdate: (id: string, patch: Partial<CollectionEntry>) => void;
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

      <div className="collection-actions">
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
        <div className="collection-grid">
          {collection.map((entry) => (
            <article className="collection-card" key={entry.id}>
              <img src={entry.item.imageUrl} alt={entry.item.name} />
              <div>
                <h3>
                  {entry.item.name} {entry.item.boxNumber ? `#${entry.item.boxNumber}` : ''}
                </h3>
                <p>{formatCurrency(entry.valuation.medianPrice)} estimated median</p>
                <select
                  value={entry.condition}
                  onChange={(event) => onUpdate(entry.id, { condition: event.target.value as Condition })}
                >
                  <option value="mint">Mint</option>
                  <option value="good">Good</option>
                  <option value="damaged">Damaged</option>
                  <option value="out of box">Out of box</option>
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
        <EmptyState title="Collection is empty" body="Save estimated Pops here to track total collection value." />
      )}
    </section>
  );
}

export default App;
