import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, CheckCircle2, FileText, Link2, Loader2, LockKeyhole, ScanSearch, ShieldCheck, Upload, X } from "lucide-react";
import { ChangeEvent, useState } from "react";
import { toast } from "sonner";
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.mjs?url";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_TEXT_LENGTH = 60_000;
type DocumentKind = "cv" | "job";
type ReviewResult = { fitScore: number; summary: string; matchedRequirements: Array<{ requirement: string; evidenceQuote: string; explanation: string }>; unsupportedGaps: string[]; tailoringDirections: string[]; safetyNote: string; sourceUrl: string | null };

function cleanText(value: string) {
  return value.replace(/\0/g, "").replace(/\r\n/g, "\n").trim().slice(0, MAX_TEXT_LENGTH);
}

async function extractText(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "txt" || extension === "md" || extension === "rtf") return cleanText(await file.text());
  const buffer = await file.arrayBuffer();
  if (extension === "docx") {
    const mammoth = await import("mammoth");
    return cleanText((await mammoth.extractRawText({ arrayBuffer: buffer })).value);
  }
  if (extension === "pdf") {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    const document = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map(item => "str" in item ? item.str : "").join(" "));
      if (pages.join("\n").length >= MAX_TEXT_LENGTH) break;
    }
    return cleanText(pages.join("\n"));
  }
  throw new Error("Choose a PDF, DOCX, TXT, Markdown or RTF document.");
}

function FilePicker({ label, hint, value, onPick, onClear, busy }: { label: string; hint: string; value: string; onPick: (file: File) => void; onClear: () => void; busy: boolean }) {
  return <div className="blueprint-frame bg-[#04194B]/70 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold text-white">{label}</p><p className="mt-1 text-xs leading-5 text-blue-100/70">{hint}</p></div>{value ? <Badge variant="outline" className="rounded-none border-emerald-200/50 bg-emerald-100/10 text-emerald-50">Text loaded</Badge> : <Badge variant="outline" className="rounded-none border-white/25 text-blue-100/70">Optional upload</Badge>}</div><div className="mt-4 flex flex-wrap items-center gap-3"><label className="inline-flex h-9 cursor-pointer items-center border border-cyan-100/55 bg-cyan-100/10 px-3 text-xs font-semibold text-cyan-50 transition hover:bg-cyan-100/20"><Upload className="mr-2 h-4 w-4" />{busy ? "Extracting…" : "Choose document"}<Input className="sr-only" disabled={busy} type="file" accept=".pdf,.docx,.txt,.md,.rtf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,application/rtf" onChange={event => { const file = event.target.files?.[0]; if (file) onPick(file); event.currentTarget.value = ""; }} /></label>{value && <Button type="button" onClick={onClear} variant="ghost" size="sm" className="h-9 rounded-none text-blue-100/75 hover:bg-white/10 hover:text-white"><X className="mr-1.5 h-4 w-4" />Clear text</Button>}</div></div>;
}

function ResultPanel({ result }: { result: ReviewResult }) {
  return <section className="mt-8"><div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">EVIDENCE-BOUND REVIEW</p><h2 className="mt-2 text-2xl font-semibold text-white">Document alignment, not a hiring prediction.</h2></div><div className="border border-cyan-100/45 bg-cyan-100/10 px-5 py-3 text-right"><p className="text-[10px] tracking-[0.16em] text-cyan-100">EVIDENCE FIT</p><p className="mt-1 text-3xl font-semibold text-white">{result.fitScore}%</p></div></div><div className="blueprint-panel p-5 md:p-6"><p className="text-sm leading-7 text-blue-50">{result.summary}</p>{result.sourceUrl && <a href={result.sourceUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center text-xs font-semibold text-cyan-100 hover:text-white"><Link2 className="mr-2 h-4 w-4" />Open original job page yourself</a>}</div><div className="mt-5 grid gap-5 xl:grid-cols-2"><section className="blueprint-panel p-5"><div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-cyan-100" /><h3 className="font-semibold text-white">Supported evidence</h3></div><p className="mt-2 text-xs leading-5 text-blue-100/70">Each item must quote the supplied CV exactly; it is not a new claim.</p><div className="mt-4 space-y-3">{result.matchedRequirements.length ? result.matchedRequirements.map(item => <div key={`${item.requirement}-${item.evidenceQuote}`} className="border-l-2 border-cyan-100/80 bg-cyan-100/5 p-3"><p className="text-sm font-semibold text-white">{item.requirement}</p><blockquote className="mt-2 border-l border-white/20 pl-3 text-xs leading-5 text-cyan-50">“{item.evidenceQuote}”</blockquote><p className="mt-2 text-xs leading-5 text-blue-100/70">{item.explanation}</p></div>) : <p className="text-sm text-blue-100/70">No clear CV evidence was matched. Do not make a tailored claim.</p>}</div></section><section className="blueprint-panel p-5"><div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-100" /><h3 className="font-semibold text-white">Unsupported or unclear gaps</h3></div><p className="mt-2 text-xs leading-5 text-blue-100/70">These are deliberately excluded from any review guidance.</p><div className="mt-4 space-y-2">{result.unsupportedGaps.length ? result.unsupportedGaps.map(gap => <p key={gap} className="border-l-2 border-amber-200/80 bg-amber-100/5 p-3 text-sm leading-6 text-amber-50">{gap}</p>) : <p className="text-sm text-blue-100/70">No clear unsupported requirement was isolated. Verify every final claim yourself.</p>}</div></section></div><section className="mt-5 blueprint-panel p-5"><p className="eyebrow">REVIEW-ONLY TAILORING DIRECTIONS</p><ul className="mt-4 space-y-2">{result.tailoringDirections.map(direction => <li key={direction} className="flex gap-3 text-sm leading-6 text-blue-50"><ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-cyan-100" />{direction}</li>)}</ul><p className="mt-5 border-t border-white/15 pt-4 text-xs leading-5 text-amber-50">{result.safetyNote}</p></section></section>;
}

export default function PublicReviewer() {
  const [cvText, setCvText] = useState("");
  const [jobText, setJobText] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [extracting, setExtracting] = useState<DocumentKind | null>(null);
  const analyse = trpc.reviewer.analyse.useMutation({ onError: error => toast.error(error.message) });
  const handleFile = async (kind: DocumentKind, file: File) => {
    if (file.size > MAX_FILE_BYTES) return toast.error("Choose a file smaller than 5 MB.");
    setExtracting(kind);
    try {
      const text = await extractText(file);
      if (text.length < 60) throw new Error("The extracted text is too short. Use a text-based PDF/DOCX or paste the content instead.");
      if (kind === "cv") setCvText(text); else setJobText(text);
      toast.success(`${kind === "cv" ? "CV" : "Job description"} text loaded from ${file.name}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The document could not be read.");
    } finally {
      setExtracting(null);
    }
  };
  const runAnalysis = () => analyse.mutate({ cvText: cleanText(cvText), jobText: cleanText(jobText), sourceUrl: sourceUrl.trim() || undefined });
  const result = analyse.data as ReviewResult | undefined;
  return <main className="blueprint-grid min-h-screen bg-[#061B5A] text-white"><div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-10"><header className="flex flex-col justify-between gap-5 border-b border-white/20 pb-6 md:flex-row md:items-end"><div className="flex items-start gap-4"><div className="grid h-11 w-11 place-items-center border border-cyan-100/60 bg-cyan-100/10"><ScanSearch className="h-5 w-5 text-cyan-100" /></div><div><p className="eyebrow">OPPORTUNITY CONTROL ROOM</p><h1 className="mt-1 text-2xl font-semibold tracking-[-0.035em] md:text-3xl">CV-to-vacancy evidence reviewer</h1></div></div><div className="max-w-sm border border-white/20 bg-[#04194B]/60 px-4 py-3 text-xs leading-5 text-blue-100/80"><LockKeyhole className="mr-2 inline h-4 w-4 text-cyan-100" />No account sign-in. Files stay in this browser; comparison text is sent only when you run a review and is not saved by this app.</div></header><section className="mt-7 grid gap-6 xl:grid-cols-[1.1fr_.9fr]"><div><p className="eyebrow">INPUT ASSEMBLY</p><h2 className="mt-2 text-3xl font-semibold tracking-[-0.035em]">Compare only what you can evidence.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100/75">Upload or paste a CV and a job description from any job site. The URL is a reference only: the app does not read your existing browser sessions, log in to sites, or automate applications.</p></div><div className="blueprint-frame bg-cyan-100/10 p-4"><p className="text-[10px] font-semibold tracking-[0.16em] text-cyan-100">USAGE BOUNDARY</p><p className="mt-2 text-sm leading-6 text-cyan-50">Use the original job page yourself. Any final application, form completion or submission remains manual and user-approved.</p></div></section><section className="mt-7 grid gap-5 lg:grid-cols-2"><div className="blueprint-panel p-5 md:p-6"><div className="flex items-center gap-3"><FileText className="h-5 w-5 text-cyan-100" /><div><p className="eyebrow">01 · CV EVIDENCE</p><p className="mt-1 text-sm text-blue-100/75">Upload a previous CV or paste the CV text.</p></div></div><div className="mt-5"><FilePicker label="Upload CV" hint="PDF, DOCX, TXT, Markdown or RTF · 5 MB maximum" value={cvText} busy={extracting === "cv"} onPick={file => handleFile("cv", file)} onClear={() => setCvText("")} /><Textarea value={cvText} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setCvText(event.target.value.slice(0, MAX_TEXT_LENGTH))} rows={15} placeholder="Paste CV text here, or upload a supported document above." className="mt-4 resize-y rounded-none border-white/25 bg-[#04194B]/80 text-white placeholder:text-blue-100/35" /><p className="mt-2 text-right text-[10px] tabular-nums text-blue-100/55">{cvText.length.toLocaleString()} / {MAX_TEXT_LENGTH.toLocaleString()} characters</p></div></div><div className="blueprint-panel p-5 md:p-6"><div className="flex items-center gap-3"><Link2 className="h-5 w-5 text-cyan-100" /><div><p className="eyebrow">02 · ROLE SPECIFICATION</p><p className="mt-1 text-sm text-blue-100/75">Use any job site URL, then upload or paste the role detail.</p></div></div><div className="mt-5"><label className="block"><span className="mb-2 block text-[10px] font-semibold tracking-[0.16em] text-blue-100/75">ORIGINAL JOB URL · OPTIONAL</span><Input type="url" value={sourceUrl} onChange={event => setSourceUrl(event.target.value)} placeholder="https://careers.example.com/job/..." className="rounded-none border-white/25 bg-[#04194B]/80 text-white placeholder:text-blue-100/35" /></label><div className="mt-4"><FilePicker label="Upload job description" hint="PDF, DOCX, TXT, Markdown or RTF · 5 MB maximum" value={jobText} busy={extracting === "job"} onPick={file => handleFile("job", file)} onClear={() => setJobText("")} /></div><Textarea value={jobText} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setJobText(event.target.value.slice(0, MAX_TEXT_LENGTH))} rows={12} placeholder="Paste the full job description and requirements here, or upload the specification above." className="mt-4 resize-y rounded-none border-white/25 bg-[#04194B]/80 text-white placeholder:text-blue-100/35" /><p className="mt-2 text-right text-[10px] tabular-nums text-blue-100/55">{jobText.length.toLocaleString()} / {MAX_TEXT_LENGTH.toLocaleString()} characters</p></div></div></section><section className="mt-6 flex flex-col justify-between gap-5 border border-cyan-100/35 bg-[#04194B]/75 p-5 md:flex-row md:items-center"><div><p className="text-sm font-semibold text-white">Evidence boundary is active.</p><p className="mt-1 max-w-2xl text-xs leading-5 text-blue-100/70">The review identifies only direct support from the uploaded or pasted CV. It labels missing or unclear requirements as gaps and does not create an application or claim unsupported experience.</p></div><Button type="button" onClick={runAnalysis} disabled={analyse.isPending || extracting !== null || cvText.trim().length < 60 || jobText.trim().length < 60} className="shrink-0 rounded-none bg-cyan-100 px-6 text-[#061B5A] hover:bg-white">{analyse.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanSearch className="mr-2 h-4 w-4" />}{analyse.isPending ? "Comparing evidence…" : "Run factual comparison"}</Button></section>{result && <ResultPanel result={result} />}<footer className="mt-10 border-t border-white/15 pt-5 text-xs leading-5 text-blue-100/55">This reviewer does not access third-party accounts, browse authenticated pages, complete application forms or submit applications. The app does not persist uploaded files or comparison text. Review every output against your source documents before using it.</footer></div></main>;
}
