import { Alert, Button, Modal } from 'antd';
import { useState } from 'react';
import { requestJson } from '../../application/auth/authContext';
import type { CitationDetailDto } from '../../infrastructure/api/generated';

export function KnowledgeCitations({citations=[]}:{citations?:readonly CitationDetailDto[]}) {
  const [source,setSource]=useState<{title:string;content:string}|null>(null);
  const [error,setError]=useState(false);
  const [pending,setPending]=useState(false);
  if (!citations.length) return <small>Nguồn không còn khả dụng hoặc câu trả lời chưa có nguồn xác thực.</small>;
  return <section aria-label="Nguồn tham khảo">
    {citations.map((citation)=><article key={citation.chunkId}>
      <Button type="link" disabled={pending} onClick={()=>{
        setPending(true);setError(false);
        void requestJson<{content:string}>(`/knowledge/documents/${encodeURIComponent(citation.documentId)}/chunks/${encodeURIComponent(citation.chunkId)}`)
          .then((value)=>setSource({title:`${citation.documentTitle} · phiên bản ${citation.documentVersion}`,content:value.content}))
          .catch(()=>setError(true)).finally(()=>setPending(false));
      }}>{citation.documentTitle} · phiên bản {citation.documentVersion}</Button>
      <blockquote>{citation.excerpt}</blockquote>
    </article>)}
    {error?<Alert type="warning" title="Không thể mở nguồn. Tài liệu có thể đã được thay thế hoặc quyền đọc đã thay đổi." />:null}
    <Modal open={Boolean(source)} title={source?.title} onCancel={()=>setSource(null)} footer={<Button onClick={()=>setSource(null)}>Đóng</Button>}><p style={{whiteSpace:'pre-wrap'}}>{source?.content}</p></Modal>
  </section>;
}
