import {runReleaseWhatIf} from './release-whatif.js';
self.onmessage=({data})=>{try{const result=runReleaseWhatIf(data.dataset,data.input,progress=>self.postMessage({progress}));self.postMessage({result});}catch(error){self.postMessage({error:error.message});}};
